const percent = number => `${(number * 100).toFixed(1)}%`;
const stepNumber = number => Number(number.toFixed(4)).toString();
const squaredLoss = weight => 2.5 * (weight - 2) ** 2;
const gradientAt = weight => 5 * (weight - 2);

function softmax(scores) {
  const maxScore = Math.max(...scores);
  const exponents = scores.map(score => Math.exp(score - maxScore));
  const denominator = exponents.reduce((sum, value) => sum + value, 0);
  return exponents.map(value => value / denominator);
}

function trainScoreTable(rowIds, targets, rows, cols, steps) {
  const table = Array.from({ length: rows }, () => Array(cols).fill(0));
  const snapshots = [];
  for (let step = 0; step <= steps; step += 1) {
    const probabilities = table.map(softmax);
    const loss = rowIds.reduce((sum, row, index) => sum - Math.log(probabilities[row][targets[index]]), 0) / rowIds.length;
    snapshots.push({ probabilities, loss });
    rowIds.forEach((row, index) => {
      table[row] = table[row].map((score, column) =>
        score - (probabilities[row][column] - Number(column === targets[index])) / rowIds.length
      );
    });
  }
  return snapshots;
}

function buildTrainingFrames({ rate }) {
  const learningRate = Number(rate);
  const frames = [];
  let weight = 0;
  for (let step = 0; step <= 6; step += 1) {
    const past = frames.at(-1)?.weight ?? 0;
    const description = step
      ? `用上一轮的梯度更新参数：${stepNumber(past)} − ${learningRate} × (${stepNumber(gradientAt(past))}) = ${stepNumber(weight)}。`
      : '从 weight = 0 开始。曲线的最低点在 weight = 2，当前位置的斜率决定下一步的方向。';
    frames.push({
      kind: 'plot', weight, history: [...frames.map(frame => frame.weight), weight],
      title: step ? `完成第 ${step} 次更新` : '从初始参数出发', description,
      metrics: [['当前 weight', stepNumber(weight)], ['当前位置 loss', stepNumber(squaredLoss(weight))], ['当前位置梯度', stepNumber(gradientAt(weight))]],
    });
    weight -= learningRate * gradientAt(weight);
  }
  return frames;
}

function buildTokenFrames({ sentence }) {
  const tokens = Array.from(sentence);
  const vocabulary = [...new Set(tokens)];
  const ids = tokens.map(token => vocabulary.indexOf(token));
  const data = { kind: 'tokens', tokens, ids, position: -1 };
  const frames = [
    { ...data, phase: 0, title: '把原文切开', description: '按字符切分。每个方格代表一个 token，句中的标点也占一个位置。', metrics: [['原文长度', `${tokens.length} 个 token`]] },
    { ...data, phase: 1, title: '从词表查出编号', description: '从 0 开始编号。再次遇到同一个字时，沿用已经分配的编号。', metrics: [['不同 token', `${vocabulary.length} 个`], ['“爱”的编号', ids[tokens.indexOf('爱')]]] },
    { ...data, phase: 2, title: '输入和目标错开一位', description: '输入从原文第一个字开始，目标从第二个字开始。上下同一列组成一道预测题。', metrics: [['预测位置', `${tokens.length - 1} 个`]] },
  ];
  for (let position = 0; position < tokens.length - 1; position += 1) {
    const prefix = tokens.slice(0, position + 1).join('');
    frames.push({
      ...data, phase: 2, position,
      title: `查看第 ${position + 1} 道题`,
      description: `此时可用的前文是“${prefix}”。原文的下一个字“${tokens[position + 1]}”就是目标。`,
      metrics: [['当前 token ID', ids[position]], ['目标 token ID', ids[position + 1]]],
    });
  }
  return frames;
}

function buildBigramFrames({ token }) {
  const vocabulary = Array.from('我爱学习');
  const row = vocabulary.indexOf(token);
  const targets = [1, 2, 3];
  const results = trainScoreTable([0, 1, 2], targets, 4, 4, 20);
  const target = targets[row];
  return [0, 1, 5, 10, 20].map(step => {
    const current = results[step];
    const description = !step
      ? '四个候选分数都从 0 开始。softmax 将概率平均分给整个词表。'
      : target === undefined
        ? '“习”只作为目标出现。从这行分数取预测的训练样本为零，所以它仍是均等概率。'
        : `看到“${token}”时，用“${vocabulary[target]}”作为目标。每步训练都会提高“${vocabulary[target]}”的概率。`;
    return {
      kind: 'bars', labels: vocabulary, values: current.probabilities[row], target,
      title: step ? `训练 ${step} 步后` : '候选概率从均等开始', description,
      caption: `当前 token 为“${token}”`,
      metrics: [['整批样本 loss', current.loss.toFixed(4)], ['当前行的目标', vocabulary[target] ?? '无训练样本']],
    };
  });
}

function buildContextFrames({ dataset }) {
  const sentences = ['我爱猫', dataset === 'shared' ? '我爱狗' : '你爱狗'];
  const vocabulary = [...new Set(sentences.join(''))];
  const targets = sentences.map(sentence => vocabulary.indexOf(sentence.at(-1)));
  return [1, 2].flatMap(windowSize => {
    const contexts = sentences.map(sentence => sentence.slice(-windowSize - 1, -1));
    const rows = [...new Set(contexts)];
    const snapshots = trainScoreTable(contexts.map(context => rows.indexOf(context)), targets, rows.length, vocabulary.length, 40);
    return [0, 40].map(step => {
      const share = rows.length === 1;
      const description = step === 0
        ? `两条样本分别给出“${contexts[0]}”和“${contexts[1]}”，此时${share ? '共用一行' : '各有一行'}，候选概率从均等开始。`
        : share
          ? `两条样本同时训练了“${rows[0]}”这一行，猫和狗出现次数相同，得到相同的概率。`
          : `“${rows[0]}”和“${rows[1]}”落在两行，各自提高了训练目标的概率。`;
      return {
        kind: 'comparison', title: `看 ${windowSize} 个字 · ${step ? '训练后' : '训练前'}`, description,
        caption: `${sentences[0]} / ${sentences[1]}`,
        metrics: [['分数表行数', rows.length], ['更新次数', step]],
        rows: rows.map((row, index) => ({
          context: row, labels: ['猫', '狗'],
          values: targets.map(target => snapshots[step].probabilities[index][target]),
          target: step && !share ? index : undefined,
        })),
      };
    });
  });
}

function buildEmbeddingFrames({ dimension, context }) {
  const run = EMBEDDING_RUNS[dimension];
  const sample = run.sentences.findIndex(sentence => sentence.startsWith(context));
  const tokens = Array.from(context);
  const ids = tokens.map(token => run.vocabulary.indexOf(token));
  const size = Number(dimension);
  const target = run.vocabulary.indexOf(run.sentences[sample].at(-1));
  const vectors = { kind: 'vectors', tokens, ids, size };
  const start = run.snapshots[0];
  const startVectors = ids.map(id => start.vectors[id]);
  const frames = [
    { ...vectors, values: startVectors, combined: false, title: '用编号查出向量', description: `每个字的 ID 都指向嵌入表中的一行。每行有 ${size} 个可训练的数字。`, metrics: [['每个 token 的维度', size], ['上下文 token 数', tokens.length]] },
    { ...vectors, values: startVectors, combined: true, title: '按顺序拼接', description: `把“${tokens[0]}”的 ${size} 个数字放在前面，把“${tokens[1]}”的 ${size} 个数字接在后面。`, metrics: [['拼接后的维度', size * tokens.length], ['候选总数', run.vocabulary.length]] },
  ];
  [0, 1, 10, 40].forEach(step => {
    const snapshot = run.snapshots[step];
    const shared = snapshot.vectors[run.vocabulary.indexOf('爱')];
    frames.push({
      kind: 'bars', labels: run.vocabulary, values: snapshot.probabilities[sample], target,
      title: step ? `训练 ${step} 步后` : '线性层给候选打分',
      caption: `当前上下文为“${context}”`,
      description: step
        ? '梯度同时更新嵌入表和线性层。切换上下文，检查两处“爱”的向量是否相同。'
        : '线性层先为词表里的每个候选算出分数，softmax 再把分数转换成概率。',
      metrics: [['整批样本 loss', snapshot.loss.toFixed(4)], ['“爱”的嵌入', `[${shared.map(value => value.toFixed(2)).join(', ')}]`]],
    });
  });
  return frames;
}

const LABS = {
  1: { build: buildTrainingFrames, options: [{ key: 'rate', label: '学习率', initial: '0.1', values: [['0.05', '0.05'], ['0.1', '0.10'], ['0.15', '0.15'], ['0.25', '0.25']] }] },
  2: { build: buildTokenFrames, options: [{ key: 'sentence', label: '实验句子', initial: '我爱学习', values: [['我爱学习', '我爱学习'], ['我爱学习，也爱练习', '我爱学习，也爱练习']] }] },
  3: { build: buildBigramFrames, options: [{ key: 'token', label: '当前 token', initial: '爱', values: Array.from('我爱学习', token => [token, token]) }] },
  4: { build: buildContextFrames, options: [{ key: 'dataset', label: '训练样本', initial: 'distinct', values: [['distinct', '我爱猫 / 你爱狗'], ['shared', '我爱猫 / 我爱狗']] }] },
  5: { build: buildEmbeddingFrames, options: [
    { key: 'context', label: '上下文', initial: '我爱', values: [['我爱', '我爱'], ['你爱', '你爱']] },
    { key: 'dimension', label: '嵌入维度', initial: '2', values: [['2', '2 维'], ['3', '3 维']] },
  ] },
};

function renderTokens(frame) {
  const { tokens, ids, phase, position } = frame;
  const cell = (index, style = '') => `<div class="token-cell ${style}"><span>${tokens[index]}</span>${phase > 0 ? `<small>${ids[index]}</small>` : ''}</div>`;
  if (phase < 2) {
    return `<div class="stage-reveal"><p class="track-title">${phase === 0 ? '切分后的 token' : 'token 与编号'}</p><div class="token-line">${tokens.map((_, index) => cell(index, phase === 1 && tokens[index] === '爱' ? 'active' : '')).join('')}</div></div>`;
  }
  const inputCells = tokens.slice(0, -1).map((_, index) => cell(index, index === position ? 'active' : position >= 0 && index > position ? 'future' : ''));
  const targetCells = tokens.slice(1).map((_, index) => cell(index + 1, index === position ? 'target' : ''));
  return `<div class="stage-reveal"><div class="token-table" style="--tokens:${inputCells.length}"><span class="track-title">输入</span>${inputCells.join('')}<span class="track-title">目标</span>${targetCells.join('')}</div><p class="table-caption">${position >= 0 ? `第 ${position + 1} 列 · ${tokens.slice(0, position + 1).join('')} → ${tokens[position + 1]}` : '目标从原文的第二个 token 开始'}</p></div>`;
}

function barMarkup(label, value, isTarget, grow = false) {
  return `<div class="bar-row${isTarget ? ' target' : ''}"><span>${label}</span><span class="bar-track" aria-hidden="true"><i class="bar-fill${grow ? ' grow' : ''}" style="--value:${value * 100}%"></i></span><output>${percent(value)}</output></div>`;
}

function renderComparison(frame) {
  const rows = frame.rows.map(row => `<div class="mapping-item"><strong>“${row.context}”</strong>${row.labels.map((label, index) => barMarkup(label, row.values[index], index === row.target, true)).join('')}</div>`).join('');
  return `<div class="stage-reveal"><p class="track-title">${frame.caption}</p><div class="mapping-rows" style="--rows:${frame.rows.length}">${rows}</div><p class="table-caption">显示“猫”和“狗”的概率，剩余概率分给词表中其他字。</p></div>`;
}

function renderVectors(frame) {
  const valueCells = (values, style) => values.map(value => `<span class="vector-cell ${style}">${value.toFixed(2)}</span>`).join('');
  const lines = frame.tokens.map((token, index) => `<div class="vector-line"><strong>${token} <small class="muted-on-dark">${frame.ids[index]}</small></strong>${valueCells(frame.values[index], index === 0 ? 'active' : 'target')}</div>`).join('');
  const combined = frame.combined ? `<p class="vector-op">按顺序拼接后的 ${frame.size * frame.tokens.length} 个数字</p><div class="vector-line combined">${valueCells(frame.values[0], 'active')}${valueCells(frame.values[1], 'target')}</div>` : '';
  return `<div class="vector-grid stage-reveal">${lines}${combined}</div>`;
}

function paintLossPlot(canvas, frame, animatedWeight) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  const pixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const left = 48;
  const right = width - 15;
  const top = 29;
  const bottom = height - 37;
  const x = weight => left + weight / 2.7 * (right - left);
  const y = loss => bottom - loss / 10.8 * (bottom - top);
  const line = (x1, y1, x2, y2) => {
    context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
  };

  context.font = '12px Consolas, "Microsoft YaHei", sans-serif';
  context.fillStyle = '#bac5e1';
  context.strokeStyle = '#354263';
  context.lineWidth = 1;
  context.textAlign = 'right';
  for (const loss of [0, 2.5, 5, 7.5, 10]) {
    line(left, y(loss), right, y(loss));
    context.fillText(String(loss), left - 10, y(loss) + 4);
  }
  context.textAlign = 'center';
  for (const weight of [0, .5, 1, 1.5, 2, 2.5]) {
    line(x(weight), top, x(weight), bottom);
    context.fillText(String(weight), x(weight), bottom + 18);
  }
  context.textAlign = 'left';
  context.fillText('损失 loss', left, 16);
  context.textAlign = 'right';
  context.fillText('参数 weight', right, height - 4);

  context.strokeStyle = '#a99aff';
  context.lineWidth = 2.5;
  context.beginPath();
  for (let index = 0; index <= 90; index += 1) {
    const weight = index / 90 * 2.7;
    const point = [x(weight), y(squaredLoss(weight))];
    if (index === 0) context.moveTo(...point);
    else context.lineTo(...point);
  }
  context.stroke();

  context.fillStyle = '#a99aff';
  for (const weight of frame.history.slice(0, -1)) {
    context.beginPath(); context.arc(x(weight), y(squaredLoss(weight)), 3, 0, Math.PI * 2); context.fill();
  }
  const dotX = x(animatedWeight);
  const dotY = y(squaredLoss(animatedWeight));
  context.setLineDash([5, 5]);
  context.strokeStyle = '#83e4c58e';
  context.lineWidth = 1.5;
  line(dotX, dotY, dotX, bottom);
  context.setLineDash([]);
  context.beginPath(); context.arc(dotX, dotY, 10, 0, Math.PI * 2);
  context.fillStyle = '#83e4c538'; context.fill();
  context.beginPath(); context.arc(dotX, dotY, 5.5, 0, Math.PI * 2);
  context.fillStyle = '#83e4c5'; context.fill();
}

function createLabRenderer(element) {
  let frame;
  let canvas;
  let observer;
  let request;
  let currentWeight;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function paintPlot(next) {
    if (!canvas) {
      element.classList.add('plot-visual');
      element.innerHTML = '<canvas class="plot-canvas" role="img" aria-label="损失随参数变化的曲线"></canvas>';
      canvas = element.querySelector('canvas');
      observer = new ResizeObserver(() => paintLossPlot(canvas, frame, currentWeight));
      observer.observe(canvas);
    }
    canvas.setAttribute('aria-label', `损失曲线。当前参数 ${stepNumber(next.weight)}，当前位置损失 ${stepNumber(squaredLoss(next.weight))}。`);
    cancelAnimationFrame(request);
    const startWeight = currentWeight ?? next.weight;
    const started = performance.now();
    currentWeight = startWeight;
    if (startWeight === next.weight || reducedMotion.matches) {
      currentWeight = next.weight;
      paintLossPlot(canvas, next, currentWeight);
      return;
    }
    function animate(now) {
      const progress = Math.min(1, (now - started) / 380);
      currentWeight = startWeight + (next.weight - startWeight) * (1 - (1 - progress) ** 3);
      paintLossPlot(canvas, next, currentWeight);
      if (progress < 1) request = requestAnimationFrame(animate);
    }
    request = requestAnimationFrame(animate);
  }

  function update(next) {
    const formerKind = frame?.kind;
    frame = next;
    if (next.kind === 'plot') paintPlot(next);
    if (next.kind === 'tokens') element.innerHTML = renderTokens(next);
    if (next.kind === 'comparison') element.innerHTML = renderComparison(next);
    if (next.kind === 'vectors') element.innerHTML = renderVectors(next);
    if (next.kind === 'bars') {
      if (formerKind !== 'bars') {
        element.innerHTML = `<div><p class="track-title"></p><div class="score-bars">${next.labels.map((label, index) => barMarkup(label, next.values[index], index === next.target)).join('')}</div></div>`;
      }
      element.querySelector('.track-title').textContent = next.caption;
      element.querySelectorAll('.bar-row').forEach((row, index) => {
        row.classList.toggle('target', index === next.target);
        row.querySelector('.bar-fill').style.setProperty('--value', `${next.values[index] * 100}%`);
        row.querySelector('output').textContent = percent(next.values[index]);
      });
    }
  }

  return { update, dispose() { observer?.disconnect(); cancelAnimationFrame(request); } };
}
