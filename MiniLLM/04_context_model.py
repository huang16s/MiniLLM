"""第四课：比较只看一个字和看两个字的预测模型。"""

import torch


def train_context_table(contexts, targets, vocab_size):
    # 相同的上下文共享一行分数。每一列仍是一个候选 token。
    context_to_id = {context: index for index, context in enumerate(dict.fromkeys(contexts))}
    row_ids = torch.tensor([context_to_id[context] for context in contexts])
    scores = torch.zeros((len(context_to_id), vocab_size), requires_grad=True)
    learning_rate = 1.0

    for _ in range(40):
        scores.grad = None
        predictions = scores[row_ids]
        loss = torch.nn.functional.cross_entropy(predictions, targets)
        loss.backward()

        with torch.no_grad():
            scores -= learning_rate * scores.grad

    with torch.no_grad():
        probabilities = scores.softmax(dim=1)

    return {context: probabilities[row_id].tolist() for context, row_id in context_to_id.items()}


sentences = ["我爱猫", "你爱狗"]
vocabulary = list(dict.fromkeys("".join(sentences)))
token_to_id = {token: token_id for token_id, token in enumerate(vocabulary)}

# 每句话的最后一个字是目标，前面的字是可供模型使用的上下文。
targets = torch.tensor([token_to_id[sentence[-1]] for sentence in sentences])
one_token_contexts = [sentence[-2] for sentence in sentences]
two_token_contexts = [sentence[-3:-1] for sentence in sentences]

one_token_model = train_context_table(one_token_contexts, targets, len(vocabulary))
two_token_model = train_context_table(two_token_contexts, targets, len(vocabulary))

for title, model in (("只看最后一个字", one_token_model), ("看最后两个字", two_token_model)):
    print(title)
    for context, probabilities in model.items():
        choices = "  ".join(f"{token} {probability:.1%}" for token, probability in zip(vocabulary, probabilities))
        print(f"  {context} -> {choices}")
