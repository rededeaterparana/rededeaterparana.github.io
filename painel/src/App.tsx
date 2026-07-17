import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Visao } from './pages/Visao';
import { Diagnostico } from './pages/Diagnostico';
import { Metodologia } from './pages/Metodologia';
import { Empresas } from './pages/Empresas';
import { Infraestrutura } from './pages/Infraestrutura';
import { Lista } from './pages/Lista';

export function App() {
  return (
    <HashRouter>
      <div className="layout">
        <nav className="nav">
          <a className="voltar" href="../">← Início</a>
          <span className="titulo">Painel — Rede Paranaense de ATER</span>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'ativo' : ''}>Visão</NavLink>
          <NavLink to="/diagnostico" className={({ isActive }) => isActive ? 'ativo' : ''}>Diagnóstico</NavLink>
          <NavLink to="/metodologia" className={({ isActive }) => isActive ? 'ativo' : ''}>Metodologia</NavLink>
          <NavLink to="/empresas" className={({ isActive }) => isActive ? 'ativo' : ''}>Empresas</NavLink>
          <NavLink to="/infraestrutura" className={({ isActive }) => isActive ? 'ativo' : ''}>Infraestrutura</NavLink>
          <NavLink to="/lista" className={({ isActive }) => isActive ? 'ativo' : ''}>Lista</NavLink>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Visao />} />
            <Route path="/diagnostico" element={<Diagnostico />} />
            <Route path="/metodologia" element={<Metodologia />} />
            <Route path="/empresas" element={<Empresas />} />
            <Route path="/infraestrutura" element={<Infraestrutura />} />
            <Route path="/lista" element={<Lista />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
