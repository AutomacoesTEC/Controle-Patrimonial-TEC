export default function PageSkeleton() {
  return (
    <div className="page-skeleton" style={{ padding: '24px' }} role="status" aria-live="polite" aria-label="Carregando tela">
      <span className="sr-only">Carregando tela</span>
      <div className="skeleton" style={{ width: '220px', height: '28px', marginBottom: '24px' }} />
      <div className="skeleton" style={{ width: '100%', height: '120px', marginBottom: '16px' }} />
      <div className="skeleton" style={{ width: '100%', height: '48px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '100%', height: '48px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '100%', height: '48px' }} />
    </div>
  );
}
