import { Suspense, lazy } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Carregando } from './components/Carregando';

// Cada página vira um chunk próprio: os JSONs grandes (diagnóstico, empresas)
// só são baixados quando a rota correspondente é visitada.
const Visao = lazy(() => import('./pages/Visao').then((m) => ({ default: m.Visao })));
const Diagnostico = lazy(() => import('./pages/Diagnostico').then((m) => ({ default: m.Diagnostico })));
const Metodologia = lazy(() => import('./pages/Metodologia').then((m) => ({ default: m.Metodologia })));
const Empresas = lazy(() => import('./pages/Empresas').then((m) => ({ default: m.Empresas })));
const Infraestrutura = lazy(() => import('./pages/Infraestrutura').then((m) => ({ default: m.Infraestrutura })));
const Lista = lazy(() => import('./pages/Lista').then((m) => ({ default: m.Lista })));

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={envolver(<Visao />)} />
          <Route path="/infraestrutura" element={envolver(<Infraestrutura />)} />
          <Route path="/lista" element={envolver(<Lista />)} />
          <Route path="/diagnostico" element={envolver(<Diagnostico />)} />
          <Route path="/metodologia" element={envolver(<Metodologia />)} />
          <Route path="/empresas" element={envolver(<Empresas />)} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

function envolver(pagina: React.ReactNode) {
  return <Suspense fallback={<Carregando />}>{pagina}</Suspense>;
}
