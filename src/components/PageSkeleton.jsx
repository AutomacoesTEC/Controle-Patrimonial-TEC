export default function PageSkeleton() {
  return (
    <div style={{ padding: '24px' }}>
      <div className="skeleton" style={{ width: '220px', height: '28px', marginBottom: '24px' }} />
      <div className="skeleton" style={{ width: '100%', height: '120px', marginBottom: '16px' }} />
      <div className="skeleton" style={{ width: '100%', height: '48px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '100%', height: '48px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '100%', height: '48px' }} />
    </div>
  );
}
