/* ============================================================
   WYRM — нарративный diff для механики «Слияние» (Студия 01)
   Построчно-посегментный diff двух версий главы (LCS по предложениям).
   Чистая функция, без зависимостей. Возвращает ханки:
     { type: 'ctx' | 'add' | 'del', text }
   где ctx — общий фрагмент, del — есть в target и убран в source,
   add — добавлен source-веткой относительно target.
   ============================================================ */

// HTML/текст → массив предложений (теги вырезаются)
function sentences(t) {
  return String(t || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// LCS-diff двух массивов строк → последовательность ханков
export function diffSentences(targetText, sourceText) {
  const A = sentences(targetText); // target (текущий канон)
  const B = sentences(sourceText); // source (предлагаемая ветвь)
  const m = A.length, n = B.length;
  // таблица длин LCS
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) { out.push({ type: 'ctx', text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: A[i] }); i++; }
    else { out.push({ type: 'add', text: B[j] }); j++; }
  }
  while (i < m) out.push({ type: 'del', text: A[i++] });
  while (j < n) out.push({ type: 'add', text: B[j++] });
  return coalesceConflicts(out);
}

// Соседний прогон удалений, за которым сразу идёт прогон добавлений, — это
// переписанный фрагмент, т.е. КОНФЛИКТ: ревьюер выбирает линию (канон vs ветвь),
// а не принимает/отклоняет по отдельности. Склеиваем их в один hunk
//   { type:'conflict', text: <текущий канон>, them: <предложение ветви> }.
// Чистые удаления и чистые добавления остаются как есть.
function coalesceConflicts(hunks) {
  const out = [];
  let i = 0;
  while (i < hunks.length) {
    if (hunks[i].type === 'del') {
      const dels = [];
      while (i < hunks.length && hunks[i].type === 'del') { dels.push(hunks[i].text); i++; }
      const adds = [];
      while (i < hunks.length && hunks[i].type === 'add') { adds.push(hunks[i].text); i++; }
      if (adds.length) out.push({ type: 'conflict', text: dels.join(' '), them: adds.join(' ') });
      else dels.forEach(t => out.push({ type: 'del', text: t }));
    } else {
      out.push(hunks[i]); i++;
    }
  }
  return out;
}

// Собрать итоговый текст слияния по решениям.
// decided[id]: 'reject' | undefined(=принято). add принят → включаем;
// del принят → применяем удаление (опускаем); del отклонён → оставляем.
// conflict: 'them' → берём текст ветви, иначе оставляем текущий канон (text).
export function applyMerge(hunks, decided) {
  const keep = [];
  hunks.forEach((h, id) => {
    const rejected = decided[id] === 'reject';
    if (h.type === 'ctx') keep.push(h.text);
    else if (h.type === 'add') { if (!rejected) keep.push(h.text); }
    else if (h.type === 'del') { if (rejected) keep.push(h.text); }
    else if (h.type === 'conflict') { keep.push(decided[id] === 'them' ? h.them : h.text); }
  });
  return keep.join(' ');
}
