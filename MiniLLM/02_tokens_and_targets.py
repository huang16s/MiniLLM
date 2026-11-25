"""第二课：把一段文字变成下一 token 预测的训练样本。"""

import torch


text = "我爱学习"

# 这一课按字符切分，每个字符就是一个 token。
tokens = list(text)
# 去重并保留首次出现的顺序，让同一个 token 始终用同一个编号。
vocabulary = list(dict.fromkeys(tokens))
token_to_id = {token: token_id for token_id, token in enumerate(vocabulary)}
token_ids = torch.tensor([token_to_id[token] for token in tokens], dtype=torch.long)

# 用当前位置及其之前的 token 预测下一位置的 token。
inputs = token_ids[:-1]  # 从开头取到倒数第二个
targets = token_ids[1:]  # 从第二个取到结尾

print(f"原文：{text}")
print(f"词表：{token_to_id}")
print(f"输入 ID：{inputs.tolist()}")
print(f"目标 ID：{targets.tolist()}")

print("\n当前位置能看到的文字 -> 下一个 token")
for position, target_id in enumerate(targets.tolist()):
    prefix = "".join(tokens[: position + 1])
    print(f"{prefix} -> {vocabulary[target_id]}")
