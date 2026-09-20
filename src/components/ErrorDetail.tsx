/** エラー文言の下に折りたたみで生の詳細を表示する */
export function ErrorDetail({ detail }: { detail?: string }) {
  if (!detail) return null;
  return (
    <details style={{ marginTop: 6, fontSize: 12 }}>
      <summary style={{ cursor: 'pointer' }}>詳細（問い合わせ時にこの内容をお知らせください）</summary>
      <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 4 }}>{detail}</code>
    </details>
  );
}
