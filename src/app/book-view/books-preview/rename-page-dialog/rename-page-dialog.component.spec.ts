import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RenamePageDialogComponent } from './rename-page-dialog.component';

describe('RenamePageDialogComponent', () => {
  let component: RenamePageDialogComponent;
  let fixture: ComponentFixture<RenamePageDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RenamePageDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RenamePageDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
