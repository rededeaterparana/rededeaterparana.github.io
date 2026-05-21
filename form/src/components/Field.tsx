import { ReactNode } from 'react';

interface Props {
  label: string;
  obrigatorio?: boolean;
  erro?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, obrigatorio, erro, children, htmlFor }: Props) {
  return (
    <div>
      <label htmlFor={htmlFor} className={obrigatorio ? 'obrigatorio' : ''}>{label}</label>
      {children}
      {erro && <div className="erro-msg">{erro}</div>}
    </div>
  );
}
