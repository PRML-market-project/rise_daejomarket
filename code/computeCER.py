import pickle
import re
import Levenshtein

def preprocess(text):
    # 한글, 영어, 숫자만 남기고 제거 (공백, 특수문자 제거)
    return re.sub(r'[^가-힣a-zA-Z0-9]', '', text)

def cer(ref, hyp):
    ref = preprocess(ref)
    hyp = preprocess(hyp)
    return Levenshtein.distance(ref, hyp) / len(ref) if len(ref) > 0 else 0

with open("cer_refs_and_hyps.pkl", "rb") as f:
    data = pickle.load(f)
    refs = data["refs"]
    base_outputs = data["base_hyps"]
    fine_outputs = data["fine_hyps"]

# 평균 CER 계산
base_cer = sum(cer(r, h) for r, h in zip(refs, base_outputs)) / len(refs)
fine_cer = sum(cer(r, h) for r, h in zip(refs, fine_outputs)) / len(refs)

print(f"🧼 전처리 후 CER 기준")
print(f"📊 Base CER:       {base_cer:.4f}")
print(f"📈 Fine-tuned CER: {fine_cer:.4f}")
