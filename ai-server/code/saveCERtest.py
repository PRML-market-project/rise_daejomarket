import pickle
import torch
from tqdm import tqdm
from transformers import WhisperForConditionalGeneration, WhisperProcessor

# 전처리된 validation 데이터 로드
with open("val_dataset_processed.pkl", "rb") as f:
    val_dataset_processed = pickle.load(f)

device = "cuda" if torch.cuda.is_available() else "cpu"

model_name = "openai/whisper-small"
processor = WhisperProcessor.from_pretrained(model_name, language="Korean", task="transcribe")
decoder_ids = processor.get_decoder_prompt_ids(language="korean", task="transcribe")

# 1. Base 모델 추론
print("🚀 Base 모델 추론 중...")
base_model = WhisperForConditionalGeneration.from_pretrained(model_name).to(device).eval()
base_refs = []
base_hyps = []

for sample in tqdm(val_dataset_processed):
    input_features = torch.tensor(sample["input_features"], dtype=torch.float32).unsqueeze(0).to(device)
    predicted_ids = base_model.generate(input_features, forced_decoder_ids=decoder_ids)
    transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]

    base_refs.append(sample["text"])
    base_hyps.append(transcription)

# 2. Fine-tuned 모델 추론
print("🚀 Fine-tuned 모델 추론 중...")
finetuned_model_path = "C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\whisper_finetuned_ko\\checkpoint-4000"
finetuned_model = WhisperForConditionalGeneration.from_pretrained(finetuned_model_path).to(device).eval()
fine_hyps = []

for sample in tqdm(val_dataset_processed):
    input_features = torch.tensor(sample["input_features"], dtype=torch.float32).unsqueeze(0).to(device)
    predicted_ids = finetuned_model.generate(input_features, forced_decoder_ids=decoder_ids)
    transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]

    fine_hyps.append(transcription)

# 결과 저장
with open("cer_refs_and_hyps.pkl", "wb") as f:
    pickle.dump({
        "refs": base_refs,
        "base_hyps": base_hyps,
        "fine_hyps": fine_hyps
    }, f)

print("✅ 추론 완료 및 결과 저장됨: cer_refs_and_hyps.pkl")