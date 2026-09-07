export function downloadText(filename, content, type='text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
}

export function safeBaseName(name='visiondeck-result') {
  return name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}._-]+/gu,'_').slice(0,70) || 'visiondeck-result';
}
