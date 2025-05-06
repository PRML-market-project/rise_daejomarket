import pickle
from datasets import load_dataset, Audio
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import os

# pickle 파일 경로
train_pickle_path = "train_dataset_processed.pkl"
val_pickle_path = "val_dataset_processed.pkl"

'''
# 파일이 존재하면 삭제
if os.path.exists(train_pickle_path):
    os.remove(train_pickle_path)
    print(f"{train_pickle_path} 파일이 삭제되었습니다.")
else:
    print(f"{train_pickle_path} 파일을 찾을 수 없습니다.")

if os.path.exists(val_pickle_path):
    os.remove(val_pickle_path)
    print(f"{val_pickle_path} 파일이 삭제되었습니다.")
else:
    print(f"{val_pickle_path} 파일을 찾을 수 없습니다.")
'''
# 모델 이름
model_name = "openai/whisper-small"

# 데이터 불러오기
train_dataset = load_dataset("json", data_files="C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\processed_data_training_ko\\training_output_jsonl\\training_output.jsonl", split="train")
val_dataset = load_dataset("json", data_files="C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\processed_data_validation_ko\\validation_output_jsonl\\validation_output.jsonl", split="train")

# 오디오 데이터 타입으로 변환
train_dataset = train_dataset.cast_column("audio", Audio(sampling_rate=16000))
val_dataset = val_dataset.cast_column("audio", Audio(sampling_rate=16000))

# Processor 불러오기 (tokenizer + feature extractor 통합)
processor = WhisperProcessor.from_pretrained(model_name, language="Korean", task="transcribe")

# 전처리 함수
def preprocess(batch):
    audio = batch["audio"]["array"]
    inputs = processor(audio, sampling_rate=16000, return_tensors="pt")
    batch["input_features"] = inputs.input_features[0]
    batch["labels"] = processor.tokenizer(batch["text"], return_tensors="pt").input_ids[0]
    return batch

# 전처리 후 데이터 저장
train_dataset_processed = train_dataset.map(preprocess)
val_dataset_processed = val_dataset.map(preprocess)

# pickle로 저장
with open("train_dataset_processed.pkl", "wb") as f:
    pickle.dump(train_dataset_processed, f)

with open("val_dataset_processed.pkl", "wb") as f:
    pickle.dump(val_dataset_processed, f)

print("전처리된 데이터가 저장되었습니다.")