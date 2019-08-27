import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {EditorTools, ToolBarStateService} from './tool-bar/tool-bar-state.service';
import {EditorService, PredictedEvent} from './editor.service';
import {ActivatedRoute, Router} from '@angular/router';
import {SheetOverlayComponent} from './sheet-overlay/sheet-overlay.component';
import {ActionsService} from './actions/actions.service';
import {AutoSaver} from './auto-saver';
import {ServerStateService} from '../server-state/server-state.service';
import {NotePropertyWidgetComponent} from './property-widgets/note-property-widget/note-property-widget.component';
import {ViewChangesService} from './actions/view-changes.service';
import {Subscription} from 'rxjs';
import {MatDialog} from '@angular/material';
import {TaskStatusCodes} from './task';
import {HttpClient} from '@angular/common/http';
import {LyricsPasteToolDialogComponent} from './dialogs/lyrics-paste-tool-dialog/lyrics-paste-tool-dialog.component';
import {OverrideEditLockDialogComponent} from './dialogs/override-edit-lock-dialog/override-edit-lock-dialog.component';
import {ActionType} from './actions/action-types';
import {AlgorithmGroups} from '../book-view/book-step/algorithm-predictor-params';
import {PredictData, PredictDialogComponent} from './dialogs/predict-dialog/predict-dialog.component';
import {BlockType} from '../data-types/page/definitions';
import {PageLine} from '../data-types/page/pageLine';
import {MusicSymbol} from '../data-types/page/music-region/symbol';
import {objIntoEnumMap} from '../utils/converting';
import {PolyLine} from '../geometry/geometry';


@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class EditorComponent implements OnInit, OnDestroy {
  private _subscription = new Subscription();
  @ViewChild(SheetOverlayComponent, {static: false}) sheetOverlayComponent: SheetOverlayComponent;
  @ViewChild(NotePropertyWidgetComponent, {static: false}) notePropertyWidget: NotePropertyWidgetComponent;

  readonly TaskStatusCodes = TaskStatusCodes;
  readonly ET = EditorTools;

  private _pingStateInterval: any;
  public autoSaver: AutoSaver;
  editorCapturedMouse() { return this.sheetOverlayComponent ? this.sheetOverlayComponent.mouseCaptured() : false; }

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private actions: ActionsService,
    public editorService: EditorService,
    private serverState: ServerStateService,
    private modalDialog: MatDialog,
    private viewRef: ViewContainerRef,
    public viewChanges: ViewChangesService,
    private changeDetector: ChangeDetectorRef,
    public toolbarStateService: ToolBarStateService) {
    this.autoSaver = new AutoSaver(actions, editorService, serverState);
    this.editorService.currentPageChanged.subscribe(() => {
      this.autoSaver.destroy();
      this.autoSaver = new AutoSaver(actions, editorService, serverState);
    });
  }

  ngOnDestroy(): void {
    this.autoSaver.destroy();
    this._subscription.unsubscribe();
    if (this._pingStateInterval) {
      clearInterval(this._pingStateInterval);
    }
    this.releaseEditPage();
  }

  ngOnInit() {
    this.editorService.load(this.route.snapshot.params['book_id'], this.route.snapshot.params['page_id']);
    this._subscription.add(this.route.paramMap.subscribe(params => {
      this.editorService.select(params.get('book_id'), params.get('page_id'));
    }));

    this._subscription.add(this.toolbarStateService.runStaffDetection.subscribe(() => this.openStaffDetectionDialog()));
    this._subscription.add(this.toolbarStateService.runSymbolDetection.subscribe(() => this.openSymbolDetectionDialog()));
    this._subscription.add(this.toolbarStateService.runLayoutAnalysis.subscribe(() => this.openLayoutAnalysisDialog()));
    this._subscription.add(this.toolbarStateService.editorToolChanged.subscribe(() => this.changeDetector.markForCheck()));
    this._subscription.add(this.toolbarStateService.runLyricsPasteTool.subscribe(() => this.openLyricsPasteTool()));
    this._subscription.add(this.toolbarStateService.requestEditPage.subscribe(() => this.requestEditPage()));
    this._subscription.add(this.editorService.pageStateObs.subscribe(() => {  this.changeDetector.detectChanges(); }));
    this._subscription.add(this.editorService.pageStateObs.subscribe(page => {
      this.pollStatus();
    }));
    this._subscription.add(this.serverState.connectedToServer.subscribe(() => {
    }));
    this._subscription.add(this.serverState.disconnectedFromServer.subscribe(() => {
    }));
    this._subscription.add(this.actions.actionCalled.subscribe(
      action => {
        if (action === ActionType.Undo || action === ActionType.Redo) {
          this.sheetOverlayComponent.currentEditorTool.redraw();
        }
      }
    ));

    this._pingStateInterval = setInterval(() => {
      this.pollStatus();
    }, 5_000);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.editorService.actionStatistics.tick();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    // Match for undo redy (mac also meta key)
    if ((event.code === 'KeyZ' || event.code === 'KeyY') && (event.ctrlKey || event.metaKey)) {
      this.sheetOverlayComponent.toIdle();
      if (event.shiftKey && event.code === 'KeyZ' || !event.shiftKey && event.code === 'KeyY') {
        this.actions.redo();
      } else {
        this.actions.undo();
      }
      event.preventDefault();
    }
  }

  private pollStatus() {
    if (this.editorService.pageStateVal.zero) { return; }
    this.http.get<{locked: boolean}>(this.editorService.pageCom.lock_url(), {}).subscribe(
      r => {
        this.editorService.pageStateVal.edit = r.locked;
      },
      e => {
        this.editorService.pageStateVal.edit = false;
      }
    );
  }

  private requestEditPage(force = false) {
    if (this.editorService.pageStateVal.progress.isVerified()) { return false; }
    this.http.put<{locked: boolean, first_name: string, last_name: string, email: string}>(this.editorService.pageCom.lock_url(), {force}).subscribe(
      r => {
        this.editorService.pageStateVal.edit = r.locked;
        if (!r.locked) {
          // locked by another user, request to override
          this.modalDialog.open(OverrideEditLockDialogComponent, {
            width: '300px',
            disableClose: false,
            data: r,
          }).afterClosed().subscribe(forceRetry => {
            if (forceRetry) {
              this.requestEditPage(forceRetry);
            }
          });
        }
      }
    );
  }

  private releaseEditPage() {
    if (!this.editorService.pageStateVal.edit) { return; }
    this.http.delete(this.editorService.pageCom.lock_url(), {}).subscribe(
      r => {
      }
    );
  }

  private openPredictionDialog(group: AlgorithmGroups) {
    const state = this.editorService.pageStateVal;
    if (!state) { return; }

    const data: PredictData = {
      pageState: state,
      algorithmGroup: group,
    };

    this.modalDialog.open(PredictDialogComponent, {
      width: '400px',
      disableClose: true,
      data,
    }).afterClosed().subscribe((r) => {
      this.handleDialogResult({pageState: state, group, result: r, data});
    });
  }

  private handleDialogResult(p: PredictedEvent) {
    if (!p) { return; }
    if (p.group === AlgorithmGroups.StaffLines) {
      if (!p.result.staffs) {
        console.error('No staff transmitted');
      } else {
        this.actions.clearAllStaves(p.data.pageState.pcgts.page);
        this.actions.startAction(ActionType.StaffLinesAutomatic);
        p.result.staffs.forEach(json => {
          const mr = this.actions.addNewBlock(p.data.pageState.pcgts.page, BlockType.Music);
          const staff = PageLine.fromJson(json, mr);
          staff.detachFromParent();
          this.actions.attachLine(mr, staff);
        });
        this.actions.finishAction();
      }
    } else if (p.group === AlgorithmGroups.Layout) {
      if (!p.result.blocks) {
        console.error('No blocks transmitted.');
      } else {
        this.actions.clearAllLayout(p.data.pageState.pcgts.page);
        this.actions.startAction(ActionType.LayoutAutomatic);
        objIntoEnumMap<BlockType, Array<{id: string, coords: string}>>(p.result.blocks, new Map(), BlockType, false).
        forEach((trs, type) => {
          trs.forEach(block => {
            if (type === BlockType.Music) {
              let targetMr = p.data.pageState.pcgts.page.musicLineById(block.id);
              if (!targetMr) {
                const newMr = this.actions.addNewBlock(p.data.pageState.pcgts.page, BlockType.Music);
                targetMr = this.actions.addNewLine(newMr);
              }
              this.actions.changePolyLine(targetMr.coords, targetMr.coords, PolyLine.fromString(block.coords));
              this.actions.caller.pushChangedViewElement(targetMr);
            } else {
              const newTr = this.actions.addNewBlock(p.data.pageState.pcgts.page, type);
              const newTl = this.actions.addNewLine(newTr);
              this.actions.changePolyLine(newTl.coords, newTl.coords, PolyLine.fromString(block.coords));
            }
          });
        });
        this.actions.finishAction();
      }
    } else if (p.group === AlgorithmGroups.Symbols) {
      if (!p.result.musicLines) { console.error('No symbols transmitted.');
      } else {
        this.actions.clearAllSymbols(p.data.pageState.pcgts.page);
        this.actions.startAction(ActionType.SymbolsAutomatic);
        p.result.musicLines.forEach(
          ml => {
            const musicLine = p.data.pageState.pcgts.page.musicLineById(ml.id);
            const symbols = ml.symbols.map(s => MusicSymbol.fromJson(s));
            symbols.forEach(s => {
              this.actions.attachSymbol(musicLine, s);
              s.snappedCoord = s.computeSnappedCoord();
            });
          }
        );
        this.actions.finishAction();
      }
    }
    this.editorService.predicted.emit(p);
  }


  private openStaffDetectionDialog() {
    this.openPredictionDialog(AlgorithmGroups.StaffLines);
  }

  private openSymbolDetectionDialog() {
    this.openPredictionDialog(AlgorithmGroups.Symbols);
  }

  private openLayoutAnalysisDialog() {
    this.openPredictionDialog(AlgorithmGroups.Layout);
  }

  private openLyricsPasteTool() {
    this.modalDialog.open(LyricsPasteToolDialogComponent, {
      disableClose: false,
      width: '600px',
      data: {
        page: this.editorService.pcgts.page,
      }
    }).afterClosed().subscribe( () => {
        this.toolbarStateService.currentEditorTool = EditorTools.Syllables;
      }
    );
  }
}
