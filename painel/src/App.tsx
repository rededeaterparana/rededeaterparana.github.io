import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { Visao } from './pages/Visao';
import { Infraestrutura } from './pages/Infraestrutura';
import { Lista } from './pages/Lista';

export function App() {
  return (
    <HashRouter>
      <div className="layout">
        <div className="gov-bar">
          <div className="container">
            <strong>GOVERNO DO PARANÁ</strong>
            <span>Instituto de Desenvolvimento Rural do Paraná — IDR-Paraná</span>
          </div>
        </div>

        <header className="idr-header">
          <div className="container">
            <img src="./logo-idr.png" alt="IDR-Paraná" />
            <div className="titulo">
              <p className="principal">Rede Estadual de Assistência Técnica e Extensão Rural</p>
              <p className="subtitulo">Painel de visualização das entidades cadastradas</p>
            </div>
          </div>
        </header>

        <nav className="nav">
          <div className="container">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'ativo' : ''}>Visão geral</NavLink>
            <NavLink to="/infraestrutura" className={({ isActive }) => isActive ? 'ativo' : ''}>Infraestrutura</NavLink>
            <NavLink to="/lista" className={({ isActive }) => isActive ? 'ativo' : ''}>Lista de entidades</NavLink>
          </div>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={<Visao />} />
            <Route path="/infraestrutura" element={<Infraestrutura />} />
            <Route path="/lista" element={<Lista />} />
          </Routes>
        </main>

        <footer className="idr-footer">
          <div className="container">
            <div>
              <p className="footer-titulo">Instituto de Desenvolvimento Rural do Paraná — IDR-Paraná</p>
              <p className="footer-sub">Governo do Estado do Paraná</p>
            </div>
            <p>
              <a href="https://www.idrparana.pr.gov.br/" target="_blank" rel="noreferrer noopener">
                www.idrparana.pr.gov.br
              </a>
            </p>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
}
