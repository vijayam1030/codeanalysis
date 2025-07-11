import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/analyzer', pathMatch: 'full' },
  { path: 'analyzer', loadComponent: () => import('./components/code-analyzer/code-analyzer.component').then(m => m.CodeAnalyzerComponent) },
  { path: '**', redirectTo: '/analyzer' }
];
