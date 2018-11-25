import {Component, HostListener, OnInit} from '@angular/core';
import {EditorTools, PreprocessingTools, PrimaryViews, ToolBarStateService} from './tool-bar-state.service';
import {AccidentalType, ClefType, NoteType, SymbolType} from '../../data-types/page/definitions';
import {EditorService} from '../editor.service';

@Component({
  selector: 'app-tool-bar',
  templateUrl: './tool-bar.component.html',
  styleUrls: ['./tool-bar.component.css']
})
export class ToolBarComponent implements OnInit {
  PrimaryViews = PrimaryViews;
  EditorTools = EditorTools;
  PreprocessingTools = PreprocessingTools;
  SymbolType = SymbolType;
  NoteType = NoteType;
  ClefType = ClefType;
  AccidType = AccidentalType;

  constructor(public toolBarStateService: ToolBarStateService,
              public editor: EditorService) { }

  ngOnInit() {
  }

  onPrimaryTool(view: PrimaryViews) {
    this.toolBarStateService.currentPrimaryView = view;
  }

  onEditorTool(tool: EditorTools) {
    this.toolBarStateService.currentEditorTool = tool;
  }

  onEditorSymbol(symbol: SymbolType) {
    this.toolBarStateService.currentEditorSymbol = symbol;
  }

  onNoteType(note: NoteType) {
    this.toolBarStateService.currentNoteType = note;
    this.onEditorSymbol(SymbolType.Note);
  }

  onClefType(clef: ClefType) {
    this.toolBarStateService.currentClefType = clef;
    this.onEditorSymbol(SymbolType.Clef);
  }

  onAccidType(accid: AccidentalType) {
    this.toolBarStateService.currentAccidentalType = accid;
    this.onEditorSymbol(SymbolType.Accid);
  }

  onLock(tool: EditorTools) {
    this.editor.pageEditingProgress.locked.set(tool, !this.editor.pageEditingProgress.locked.get(tool));
  }

  onLockAll() {
    Object.values(EditorTools).forEach(v => this.editor.pageEditingProgress.locked.set(v, true));
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (this.toolBarStateService.currentPrimaryView === PrimaryViews.Editor) {
      if (event.code === 'Digit1') {
        this.onEditorTool(EditorTools.CreateStaffLines);
      } else if (event.code === 'Digit2') {
        this.onEditorTool(EditorTools.GroupStaffLines);
      } else if (event.code === 'Digit3') {
        this.onEditorTool(EditorTools.Layout);
      } else if (event.code === 'Digit4') {
        this.onEditorTool(EditorTools.Symbol);
      }
    }
  }
}