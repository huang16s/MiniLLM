"""第五课：学习每个 token 的向量，并用两个 token 的向量做预测。"""

import torch


torch.manual_seed(42)

sentences = ["我爱猫", "你爱狗"]
vocabulary = list(dict.fromkeys("".join(sentences)))
token_to_id = {token: token_id for token_id, token in enumerate(vocabulary)}
context_ids = torch.tensor([[token_to_id[token] for token in sentence[:-1]] for sentence in sentences])
targets = torch.tensor([token_to_id[sentence[-1]] for sentence in sentences])

embedding_dim = 2
embedding = torch.nn.Embedding(len(vocabulary), embedding_dim)
output_layer = torch.nn.Linear(2 * embedding_dim, len(vocabulary))
parameters = [embedding.weight, output_layer.weight, output_layer.bias]
learning_rate = 0.5


def predict_scores(context_ids):
    token_vectors = embedding(context_ids)  # 每个 token ID 查出一组数字
    combined = token_vectors.flatten(start_dim=1)  # 按顺序拼成每条样本的一行
    return output_layer(combined)  # 为词表里的每个候选 token 给出一个分数


shared_token_id = token_to_id["爱"]
before = embedding.weight[shared_token_id].tolist()

for step in range(1, 41):
    for parameter in parameters:
        parameter.grad = None

    scores = predict_scores(context_ids)
    loss = torch.nn.functional.cross_entropy(scores, targets)
    loss.backward()

    with torch.no_grad():
        for parameter in parameters:
            parameter -= learning_rate * parameter.grad

    if step in (1, 10, 40):
        print(f"step={step:2d}  loss_before={loss.item():.4f}")

with torch.no_grad():
    after = embedding.weight[shared_token_id].tolist()
    probabilities = predict_scores(context_ids).softmax(dim=1)

print(f"\n“爱”的向量（训练前）：{[round(value, 3) for value in before]}")
print(f"“爱”的向量（训练后）：{[round(value, 3) for value in after]}")
for sentence, row in zip(sentences, probabilities):
    predicted_id = row.argmax().item()
    print(f"{sentence[:-1]} → {vocabulary[predicted_id]}（{row[predicted_id].item():.1%}）")
