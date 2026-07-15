// Formatação de números no padrão pt-BR (milhar com ponto, decimal com vírgula).

export function inteiro(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export function decimal(n: number, casas = 1): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function indice(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function porcentagem(n: number, casas = 1): string {
  return `${decimal(n, casas)}%`;
}
