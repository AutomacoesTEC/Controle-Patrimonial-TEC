import { pessoaDoRegistro } from '../store/titularidade';

export default function SeletorTitularidade({ registro, onChange, dependentes = [], permitirAlimentando = false }) {
  const pessoa = pessoaDoRegistro(registro, dependentes);
  const tipo = pessoa === 'titular' ? 'titular' : pessoa === 'alimentando' ? 'alimentando'
    : pessoa === 'nao-informada' ? '' : 'dependente';
  const mudarTipo = value => onChange({
    ...registro, titularidade: value, beneficiario: value ? value[0].toUpperCase() + value.slice(1) : '',
    cpf_titularidade: '', cpf_dependente: '', cpf_beneficiario: '', dependenteId: null,
    titularidadeNome: '', nome_dependente: '',
  });
  const mudarDependente = value => {
    const d = dependentes.find(d => (String(d.cpf || '').replace(/\D/g, '') || `id:${d.id}`) === value);
    if (!d) return;
    const cpf = String(d.cpf || '').replace(/\D/g, '');
    onChange({ ...registro, titularidade: 'dependente', beneficiario: 'Dependente',
      cpf_titularidade: cpf, cpf_dependente: cpf, cpf_beneficiario: cpf,
      dependenteId: d.id, titularidadeNome: d.nome, nome_dependente: d.nome });
  };
  const opcoes = dependentes.map(d => ({ valor: String(d.cpf || '').replace(/\D/g, '') || `id:${d.id}`, nome: d.nome }));
  return <div className="form-row">
    <div className="form-group"><label>Titularidade</label>
      <select className="form-control" aria-label="Titularidade" value={tipo} onChange={e => mudarTipo(e.target.value)}>
        <option value="">Não informada</option><option value="titular">Titular</option><option value="dependente">Dependente</option>
        {permitirAlimentando && <option value="alimentando">Alimentando</option>}
      </select>
    </div>
    {tipo === 'dependente' && <div className="form-group"><label>Dependente</label>
      <select className="form-control" aria-label="Dependente" required value={pessoa === 'dependente-sem-identificacao' ? '' : pessoa} onChange={e => mudarDependente(e.target.value)}>
        <option value="">Selecione o dependente</option>
        {pessoa !== 'dependente-sem-identificacao' && !opcoes.some(o => o.valor === pessoa) && <option value={pessoa}>{registro.nome_dependente || registro.titularidadeNome || pessoa} (registro anterior)</option>}
        {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.nome} ({o.valor})</option>)}
      </select>
      {!opcoes.length && <small>Cadastre o dependente em Titular e Dependentes.</small>}
    </div>}
    {tipo === 'alimentando' && <div className="form-group"><label>Nome do alimentando</label><input className="form-control" required value={registro.titularidadeNome || ''} onChange={e => onChange({ ...registro, titularidadeNome: e.target.value })} /></div>}
  </div>;
}
