import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StaffGrouperService {
  readonly _states = {data: null};  // hack to store reference

  constructor() { }

  get states() {
    return this._states.data;
  }

  set states(data) {
    this._states.data = data;
  }
}
