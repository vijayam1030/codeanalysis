// Simple test to verify TypeScript compilation
import { Component } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';

interface TestInterface {
  data: string[];
}

@Component({
  selector: 'app-test',
  template: `
    <div *ngIf="testData$ | async as data">
      <div *ngIf="data && data.length > 0">
        <p *ngFor="let item of data">{{ item }}</p>
      </div>
    </div>
  `
})
export class TestComponent {
  private testSubject = new BehaviorSubject<string[]>([]);
  testData$ = this.testSubject.asObservable();

  handleError(error: any): void {
    console.error('Test error:', error);
  }

  processData(result: TestInterface): void {
    this.testSubject.next(result.data);
  }
}
