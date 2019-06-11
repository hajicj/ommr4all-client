import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {TaskWorker} from '../../editor/task';
import {BookCommunication} from '../../data-types/communication';
import {HttpClient} from '@angular/common/http';

@Component({
  selector: 'app-book-step-preprocessing-view',
  templateUrl: './book-step-preprocessing-view.component.html',
  styleUrls: ['./book-step-preprocessing-view.component.css']
})
export class BookStepPreprocessingViewComponent implements OnInit, OnDestroy {
  @Input() book: BookCommunication;
  @Input() operation: string;
  task: TaskWorker;

  constructor(
    private http: HttpClient,
  ) {
  }

  ngOnInit() {
    this.task = new TaskWorker(this.operation, this.http, this.book);
    this.task.startStatusPoller(2000);
  }

  ngOnDestroy(): void {
    this.task.stopStatusPoller();
  }

  run() {
    this.task.putTask({});
  }

  cancel() {
    this.task.cancelTask().then(
      () => {},
      () => {},
    );
  }
}
