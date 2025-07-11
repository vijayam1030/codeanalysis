import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    <div class="main-container">
      <header class="header">
        <div class="logo">
          <span class="material-icons">code</span>
          Code Analyzer
        </div>
        <div class="subtitle">Extract & Analyze Code from Images</div>
      </header>
      <main class="content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Code Analyzer';
}
