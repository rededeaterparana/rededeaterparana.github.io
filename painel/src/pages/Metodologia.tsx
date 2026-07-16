import { diagnostico } from '../lib/diagnostico';
import { decimal, indice, inteiro, porcentagem } from '../lib/formato';

const { meta, resumo } = diagnostico;

const FATORES = [
  { n: 1, nome: 'Taxa de ATER', area: 'Situação da ATER', peso: '0,20', regra: 'clamp(⌈v/10⌉, 1, 10) — crescente' },
  { n: 5, nome: 'Estab. por equivalente técnico', area: 'Situação da ATER', peso: '0,10', regra: 'clamp(11 − ⌈v/25⌉, 1, 10) — decrescente' },
  { n: 9, nome: 'Avaliação da ATER pelo CMDRS', area: 'Situação da ATER', peso: '0,10', regra: 'constante (F = 5)' },
  { n: 3, nome: 'Estabelecimentos rurais', area: 'Abrangência', peso: '0,05', regra: 'clamp(11 − ⌈v/100⌉, 1, 10) — decrescente' },
  { n: 2, nome: 'Estab. da agricultura familiar', area: 'Abrangência', peso: '0,05', regra: 'clamp(11 − ⌈v/100⌉, 1, 10) — decrescente' },
  { n: 4, nome: 'Estabelecimentos com CAF', area: 'Abrangência', peso: '0,05', regra: 'clamp(11 − ⌈v/100⌉, 1, 10) — decrescente' },
  { n: 10, nome: 'Propriedades com CAR', area: 'Abrangência', peso: '0,05', regra: 'constante (F = 5)' },
  { n: 7, nome: 'Desenvolvimento humano (IDH-M)', area: 'Impacto da ATER', peso: '0,10', regra: 'bandas absolutas — crescente' },
  { n: 6, nome: 'Valor bruto da produção por hectare', area: 'Impacto da ATER', peso: '0,10', regra: 'bandas absolutas — crescente' },
  { n: 11, nome: 'Disponibilidade hídrica', area: 'Impacto da ATER', peso: '0,10', regra: 'constante (F = 7)' },
  { n: 8, nome: 'Crédito rural', area: 'Impacto da ATER', peso: '0,10', regra: 'constante (F = 5)' },
];

const REFERENCIAS = [
  'OECD/EC-JRC (2008). Handbook on Constructing Composite Indicators: Methodology and User Guide. OECD Publishing.',
  'Fellegi, I. P. & Holt, D. (1976). A Systematic Approach to Automatic Edit and Imputation. JASA 71(353):17–35.',
  'De Waal, Pannekoek & Scholtus (2011). Handbook of Statistical Data Editing and Imputation. Wiley.',
  'van der Loo, M. & de Jonge, E. (2021). Data Validation Infrastructure for R. Journal of Statistical Software 97(10).',
  'Paruolo, Saisana & Saltelli (2013). Ratings and rankings: voodoo or science? JRSS-A 176(3):609–634.',
  'Saisana, Saltelli & Tarantola (2005). Uncertainty and sensitivity analysis... JRSS-A 168(2):307–323.',
];

export function Metodologia() {
  return (
    <>
      <p className="intro">
        O <strong>Índice de Desenvolvimento da ATER (ID-ATER)</strong> é um indicador composto
        aditivo: <code>ID-ATER = Σ(fator × peso) / 10</code>, com 11 indicadores em três áreas. Cada
        fator é um inteiro de 1 a 10 obtido por limiares absolutos sobre o valor bruto, e os pesos
        somam 1,0. O cálculo é próprio da rede, reconstruído e validado a partir dos insumos do
        Levantamento da Capacidade Instalada de ATER.
      </p>

      <section className="painel">
        <h2>Indicadores, pesos e funções de fator</h2>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th scope="col">Indicador</th>
                <th scope="col">Área</th>
                <th scope="col" style={{ textAlign: 'right' }}>Peso</th>
                <th scope="col">Função de fator</th>
              </tr>
            </thead>
            <tbody>
              {FATORES.map((f) => (
                <tr key={f.n}>
                  <td>{f.nome}</td>
                  <td>{f.area}</td>
                  <td style={{ textAlign: 'right' }}>{f.peso}</td>
                  <td>{f.regra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="legenda">
          As funções foram reconstruídas dos {inteiro(resumo.municipios)} municípios e o gerador
          aborta se não reproduzirem a planilha (invariantes: fator ∈ 1..10, Σ pesos = 1,
          índice = Σ(fator × peso) / 10).
        </p>
      </section>

      <section className="painel">
        <h2>Técnica de correção</h2>
        <p>
          O tratamento segue a edição estatística de dados (estatística oficial) e a metodologia de
          indicadores compostos do Handbook OECD/JRC: reconstruir sempre a partir dos insumos brutos
          autoritativos e reconciliar por chave (código IBGE), nunca por posição de linha.
        </p>
        <ul>
          <li>
            <strong>Reconciliação com a fonte primária.</strong> Onde a planilha derivada diverge do
            Formulário I (concordante com o Censo), o valor primário prevalece — correção dedutiva,
            não imputação. É o que desfaz a rotação da coluna de agricultura familiar.
          </li>
          <li>
            <strong>Edição lógica “parte ≤ todo”.</strong> Quando a agricultura familiar supera o
            total de estabelecimentos, o campo suspeito é o total (subcontado); sem valor autoritativo
            para o total, o município é sinalizado para revisão, não imputado.
          </li>
        </ul>
      </section>

      {meta.correcoesEstruturais.length > 0 && (
        <section className="painel">
          <h2>Correções estruturais aplicadas</h2>
          <p className="legenda" style={{ marginTop: 0 }}>
            Rotação desfeita pela reconciliação com o Formulário I. Por ser uma permutação dos mesmos
            valores, a média estadual não muda ({indice(resumo.idAterMedio)}).
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Município</th>
                  <th scope="col">Campo corrigido</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Valor (de → para)</th>
                  <th scope="col" style={{ textAlign: 'right' }}>ID-ATER (de → para)</th>
                </tr>
              </thead>
              <tbody>
                {meta.correcoesEstruturais.map((c) => (
                  <tr key={c.cod}>
                    <td>{c.municipio}</td>
                    <td>{c.campo}</td>
                    <td style={{ textAlign: 'right' }}>{inteiro(c.de)} → {inteiro(c.para)}</td>
                    <td style={{ textAlign: 'right' }}>{indice(c.indiceDe)} → {indice(c.indicePara)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {meta.dadosEmRevisao.length > 0 && (
        <section className="painel">
          <h2>Dados em revisão na fonte</h2>
          <p className="legenda" style={{ marginTop: 0 }}>
            Agricultura familiar acima do total de estabelecimentos — total aparentemente subcontado
            na coleta. O índice não foi alterado; o caso segue para verificação na fonte.
          </p>
          <ul>
            {meta.dadosEmRevisao.map((d) => (
              <li key={d.cod ?? d.municipio}><strong>{d.municipio}:</strong> {d.detalhe}.</li>
            ))}
          </ul>
        </section>
      )}

      {meta.indicadoresConstantes.length > 0 && (
        <section className="painel">
          <h2>Indicadores constantes</h2>
          <p>
            {meta.indicadoresConstantes.length} dos 11 indicadores são constantes em todos os
            municípios ({porcentagem(meta.pesoConstante * 100, 0)} do peso nominal):{' '}
            {meta.indicadoresConstantes.map((i) => i.nome).join(', ')}. Num índice aditivo eles
            deslocam o nível, mas não alteram rankings — peso efetivo ≈ 0. Recomenda-se uma análise
            de incerteza/sensibilidade formal e eventual re-ponderação entre os sete indicadores
            discriminantes.
          </p>
        </section>
      )}

      {meta.pesosEfetivos.length > 0 && (
        <section className="painel">
          <h2>Sensibilidade e pesos efetivos</h2>
          <p>
            Em agregação linear, o peso mede <em>substituibilidade</em>, não importância. A
            importância efetiva de cada indicador é sua correlação com o índice (Paruolo, Saisana &
            Saltelli, 2013): indicadores de variância zero têm peso efetivo ~0, ainda que detenham
            peso nominal.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Indicador</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Peso nominal</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Correlação</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Peso efetivo</th>
                </tr>
              </thead>
              <tbody>
                {meta.pesosEfetivos.map((p) => (
                  <tr key={p.n}>
                    <td>{p.nome}</td>
                    <td style={{ textAlign: 'right' }}>{porcentagem(p.pesoNominal * 100, 0)}</td>
                    <td style={{ textAlign: 'right' }}>{decimal(p.correlacao, 2)}</td>
                    <td style={{ textAlign: 'right' }}>{porcentagem(p.pesoEfetivo * 100, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="legenda">
            A Taxa de ATER domina (peso efetivo bem acima do nominal); os quatro indicadores
            constantes somam {porcentagem(meta.pesoConstante * 100, 0)} do peso nominal e 0% do
            efetivo — removê-los e reponderar não altera a ordenação (Spearman ρ = 0,9998). Já os
            sete indicadores discriminantes carregam incerteza: sob perturbação de ±50% nos pesos
            (Monte Carlo), o intervalo de 90% do <em>ranking</em> de um município tem largura mediana
            de ~47 posições (de {inteiro(resumo.municipios)}). As posições devem ser lidas em faixas,
            não como números exatos.
          </p>
        </section>
      )}

      <section className="painel">
        <h2>Referências</h2>
        <ul className="referencias">
          {REFERENCIAS.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </section>

      <p className="fonte">
        Fonte: {meta.fonte}. Metodologia: {meta.metodologiaIndice}. Documento técnico completo no
        repositório (docs/metodologia-id-ater.md). Agregado gerado em{' '}
        {new Date(meta.geradoEm).toLocaleDateString('pt-BR')}.
      </p>
    </>
  );
}
