import AuditLogContent from './audit-log-content';

export default function AuditPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  return <AuditLogContent params={params} />;
}
