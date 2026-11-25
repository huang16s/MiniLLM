"""第三课：训练一个根据当前 token 预测下一个 token 的模型。"""

import torch


# 沿用第二课的词表和训练数据。
text = "我爱学习"
tokens = list(text)
vocabulary = list(dict.fromkeys(tokens))
token_to_id = {token: token_id for token_id, token in enumerate(vocabulary)}
token_ids = torch.tensor([token_to_id[token] for token in tokens], dtype=torch.long)
inputs = token_ids[:-1]
targets = token_ids[1:]

# 行是当前 token，列是下一个 token 的候选。整张表都是可学习参数。
vocab_size = len(vocabulary)
scores = torch.zeros((vocab_size, vocab_size), requires_grad=True)
learning_rate = 1.0

current_token = "爱"
current_id = token_to_id[current_token]
with torch.no_grad():
    before = scores[current_id].softmax(dim=0)

for step in range(1, 21):
    scores.grad = None
    predictions = scores[inputs]  # 为每个输入 ID 取出一行候选分数
    loss = torch.nn.functional.cross_entropy(predictions, targets)
    loss.backward()

    with torch.no_grad():
        scores -= learning_rate * scores.grad

    if step in (1, 5, 10, 20):
        print(f"step={step:2d}  loss_before={loss.item():.4f}")

# softmax 把一行候选分数转换成概率，方便比较训练前后的变化。
with torch.no_grad():
    after = scores[current_id].softmax(dim=0)

print(f"\n当前 token：{current_token}")
print("候选  训练前  训练后")
for token, before_prob, after_prob in zip(vocabulary, before.tolist(), after.tolist()):
    print(f"{token}     {before_prob:5.1%}   {after_prob:5.1%}")

predicted_id = after.argmax().item()
print(f"最可能的下一个 token：{vocabulary[predicted_id]}")
