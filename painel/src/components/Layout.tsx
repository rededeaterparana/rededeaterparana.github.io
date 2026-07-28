import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { GRUPOS, PAGINAS, paginaAtual, vizinhas } from '../lib/paginas';

export function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    const pagina = paginaAtual(pathname);
    document.title = pagina
      ? `${pagina.titulo} — Painel da Rede Paranaense de ATER`
      : 'Painel — Rede Paranaense de ATER';
    window.scrollTo({ top: 0 });
    // Em telas estreitas a navegação rola horizontalmente: mantém o item ativo visível.
    document
      .querySelector('.nav-links a.ativo')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);

  return (
    <div className="layout">
      <a className="pular-conteudo" href="#conteudo">Ir para o conteúdo</a>

      <header className="cabecalho">
        <div className="cabecalho-inner">
          <a className="voltar" href="../">← Início</a>
          <div className="marca">
            <span className="marca-kicker">Rede Paranaense de Assistência Técnica e Extensão Rural</span>
            <span className="marca-titulo">Painel da Rede de ATER</span>
          </div>
          <a className="acao-aderir" href="../form/">Aderir à rede</a>
        </div>
      </header>

      <nav className="nav" aria-label="Páginas do painel">
        <div className="nav-inner">
          {GRUPOS.map((grupo) => (
            <div className="nav-grupo" key={grupo.rotulo}>
              <span className="nav-grupo-rotulo" aria-hidden="true">{grupo.rotulo}</span>
              <div className="nav-links">
                {grupo.paginas.map((p) => (
                  <NavLink
                    key={p.caminho}
                    to={p.caminho}
                    end={p.caminho === '/'}
                    title={p.descricao}
                    className={({ isActive }) => (isActive ? 'ativo' : '')}
                  >
                    {p.rotulo}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <main id="conteudo">
        <div className="pagina" key={pathname}>
          <Outlet />
          <Pager caminho={pathname} />
        </div>
      </main>

      <footer className="rodape">
        <div className="rodape-inner">
          <div className="rodape-col rodape-sobre">
            <p className="rodape-titulo">Rede Paranaense de ATER</p>
            <p>
              Cadastro público das entidades prestadoras de Assistência Técnica e
              Extensão Rural do Paraná, com diagnóstico da capacidade instalada
              nos 399 municípios.
            </p>
          </div>
          <div className="rodape-col">
            <p className="rodape-titulo">Páginas</p>
            <ul>
              {PAGINAS.map((p) => (
                <li key={p.caminho}><Link to={p.caminho}>{p.rotulo}</Link></li>
              ))}
            </ul>
          </div>
          <div className="rodape-col">
            <p className="rodape-titulo">Participe</p>
            <ul>
              <li><a href="../form/">Formulário de adesão</a></li>
              <li><a href="../">Página inicial</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Navegação sequencial no fim de cada página: anterior ← → próxima. */
function Pager({ caminho }: { caminho: string }) {
  const { anterior, proxima } = vizinhas(caminho);
  if (!anterior && !proxima) return null;
  return (
    <nav className="pager" aria-label="Navegação entre páginas">
      {anterior ? (
        <Link className="pager-link pager-anterior" to={anterior.caminho}>
          <span className="pager-rotulo">← Anterior</span>
          <span className="pager-titulo">{anterior.rotulo}</span>
        </Link>
      ) : <span />}
      {proxima ? (
        <Link className="pager-link pager-proxima" to={proxima.caminho}>
          <span className="pager-rotulo">Próxima →</span>
          <span className="pager-titulo">{proxima.rotulo}</span>
        </Link>
      ) : <span />}
    </nav>
  );
}
