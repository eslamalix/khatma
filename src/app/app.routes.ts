import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'ختمة', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
  { path: 'quran', title: 'القرآن — ختمة', loadComponent: () => import('./features/quran/quran-reader').then((m) => m.QuranReader) },
  {
    path: 'awrad',
    title: 'الأوراد — ختمة',
    loadComponent: () => import('./features/soon/soon').then((m) => m.Soon),
    data: { title: 'الأوراد', text: 'المسبحة، ومجموعاتك من الآيات مثل التحصين والرقية، وأذكار الصباح والمساء.' },
  },
  { path: 'stats', title: 'الإحصائيات — ختمة', loadComponent: () => import('./features/stats/stats').then((m) => m.Stats) },
  {
    path: 'calendar',
    title: 'التقويم — ختمة',
    loadComponent: () => import('./features/soon/soon').then((m) => m.Soon),
    data: { title: 'التقويم', text: 'قراءتك بالشهر والأسبوع واليوم، وآخر موقف وقفت عنده.' },
  },
  { path: '**', redirectTo: '' },
];
