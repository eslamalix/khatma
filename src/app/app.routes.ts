import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'ختمة', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
  { path: 'quran', title: 'القرآن — ختمة', loadComponent: () => import('./features/quran/quran-reader').then((m) => m.QuranReader) },
  {
    path: 'groups',
    title: 'مجموعاتي — ختمة',
    loadComponent: () => import('./features/groups/groups').then((m) => m.Groups),
  },
  {
    path: 'awrad',
    title: 'الأوراد — ختمة',
    loadComponent: () => import('./features/awrad/awrad').then((m) => m.Awrad),
  },
  { path: 'stats', title: 'الإحصائيات — ختمة', loadComponent: () => import('./features/stats/stats').then((m) => m.Stats) },
  {
    path: 'calendar',
    title: 'التقويم — ختمة',
    loadComponent: () => import('./features/calendar/calendar').then((m) => m.Calendar),
  },
  { path: '**', redirectTo: '' },
];
