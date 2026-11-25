"""第一课：用两个样本训练一个只有一个参数的模型。"""

import torch


# 模型通过这两对输入和目标学习规律：1 → 2，2 → 4。
inputs = torch.tensor([1.0, 2.0])
targets = torch.tensor([2.0, 4.0])

# 模型的预测公式是 y = weight * x。weight 从 0 开始，训练时会更新。
weight = torch.tensor(0.0, requires_grad=True)
learning_rate = 0.1

for step in range(1, 7):
    weight.grad = None  # 清空上一步留下的梯度
    predictions = weight * inputs  # 前向计算
    loss = (predictions - targets).square().mean()  # 计算平均平方误差
    loss.backward()  # 计算 loss 对 weight 的梯度

    # 更新 weight 时暂停梯度记录，这个更新动作本身不参与求导。
    with torch.no_grad():
        weight -= learning_rate * weight.grad

    print(f"step={step}  loss_before={loss.item():.6f}  weight_after={weight.item():.6f}")

# 用训练样本之外的输入验证模型学到的规律。
print(f"x=3  prediction={3 * weight.item():.4f}")
