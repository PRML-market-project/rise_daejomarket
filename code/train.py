import pickle
import torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration, Seq2SeqTrainer, Seq2SeqTrainingArguments
from datasets import Dataset
import time
from transformers import DataCollatorForSeq2Seq
from dataclasses import dataclass
from typing import Any, List, Dict, Union

# 모델 이름
model_name = "openai/whisper-medium"

# 저장된 전처리 데이터 불러오기
with open("train_dataset_processed.pkl", "rb") as f:
    train_dataset = pickle.load(f)

with open("val_dataset_processed.pkl", "rb") as f:
    val_dataset = pickle.load(f)

# GPU 사용 여부 확인
device = "cuda:0" if torch.cuda.is_available() else "cpu"
#device="cpu"

# Processor와 모델 불러오기
model = WhisperForConditionalGeneration.from_pretrained(model_name, torch_dtype=torch.float32)
#model = WhisperForConditionalGeneration.from_pretrained("C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\whisper_finetuned_ko\\checkpoint-1310", torch_dtype=torch.float32)
model.to(device)
processor = WhisperProcessor.from_pretrained(model_name, language='Korean')

@dataclass
class DataCollatorSpeechSeq2SeqWithPadding:
    processor: Any

    def __call__(self, features: List[Dict[str, Union[List[int], torch.Tensor]]]) -> Dict[str, torch.Tensor]:
        # 오디오 입력 처리
        input_features = [{"input_features": feature["input_features"]} for feature in features]
        batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")
        #print("📏 input_features shape:", batch["input_features"].shape)

        # 레이블 처리
        label_features = [{"input_ids": feature["labels"]} for feature in features]
        labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")

        # 패딩된 레이블에서 -100으로 채워서 손실에서 제외
        labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)

        # BOS 토큰 제거 (이미 추가된 상태일 경우)
        if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
            labels = labels[:, 1:]

        batch["labels"] = labels

        return batch


# Data Collator 이니셜라이즈
data_collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)

# Data collator 설정
#data_collator = DataCollatorForSeq2Seq(processor, model=model, padding=True)
#data_collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)


# 학습 세팅
training_args = Seq2SeqTrainingArguments(
    output_dir="C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\whisper_finetuned_ko",
    per_device_train_batch_size=1,
    per_device_eval_batch_size=1,
    gradient_accumulation_steps=16,

    learning_rate=1e-5,
    warmup_steps=35,
    max_steps=347,
    gradient_checkpointing=True,
    predict_with_generate=True,
    fp16=True,

    evaluation_strategy="steps",
    #save_strategy="epoch",

    generation_max_length=128,
    save_steps=347,
    eval_steps=347,
    logging_steps=50,

    #report_to=["tensorboard"],
    load_best_model_at_end=True,

    #num_train_epochs=3,
    #logging_steps=20,
    #save_total_limit=2,
    report_to="none",
    #save_total_limit=1,
)

# 트레이너
trainer = Seq2SeqTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    #tokenizer=processor,
    tokenizer=processor,#.feature_extractor,
    data_collator=data_collator,
    #compute_metrics=compute_metrics,
    #callbacks=[PrintRemainingTimeCallback()],
)

# 학습 시작
trainer.train()