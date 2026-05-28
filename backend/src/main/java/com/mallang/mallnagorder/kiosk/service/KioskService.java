package com.mallang.mallnagorder.kiosk.service;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.admin.exception.AdminException;
import com.mallang.mallnagorder.admin.exception.AdminExceptionType;
import com.mallang.mallnagorder.admin.repository.AdminRepository;
import com.mallang.mallnagorder.kiosk.domain.Kiosk;
import com.mallang.mallnagorder.kiosk.dto.ActivateKioskResponse;
import com.mallang.mallnagorder.kiosk.exception.KioskException;
import com.mallang.mallnagorder.kiosk.exception.KioskExceptionType;
import com.mallang.mallnagorder.kiosk.repository.KioskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class KioskService {

    private final KioskRepository kioskRepository;
    private final AdminRepository adminRepository;

    @Transactional
    public void setKiosks(Admin admin, int count){

        // 1. 기존 Kiosk 불러오기
        List<Kiosk> existingKiosks = kioskRepository.findByAdmin(admin);

        // 2. 사용 중인 Kiosk가 있는지 확인
        boolean hasActiveKiosk = existingKiosks.stream()
                .anyMatch(Kiosk::getIsActive);

        if (hasActiveKiosk) {
            throw new KioskException(KioskExceptionType.ACTIVE_KIOSK_EXISTS);
        }

        // 3. 기존 키오스크 삭제
        kioskRepository.deleteAll(existingKiosks);

        // 4. 새 키오스크 생성
        List<Kiosk> newKiosks = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            newKiosks.add(Kiosk.builder()
                    .kioskNumber(i)
                    .isActive(false)
                    .admin(admin)
                    .build());
        }

        kioskRepository.saveAll(newKiosks);

        // 로그 출력
        for (Kiosk kiosk : newKiosks) {
            log.info("Saved Kiosk - ID: {}, Number: {}, Admin ID: {}",
                    kiosk.getId(), kiosk.getKioskNumber(), admin.getId());
        }
    }

    @Transactional
    public ActivateKioskResponse activateKioskByStoreNameAndNumber(String storeName, int kioskNumber) {
        // 1. StoreName으로 Admin 조회
        Admin admin = adminRepository.findByStoreName(storeName)
                .orElseThrow(() -> new AdminException(AdminExceptionType.STORENAME_NOT_FOUND));

        // 2. AdminId + KioskNumber로 Kiosk 조회
        Kiosk kiosk = kioskRepository.findByAdminIdAndKioskNumber(admin.getId(), kioskNumber)
                .orElseThrow(() -> new KioskException(KioskExceptionType.KIOSK_NOT_FOUND));

        // 3. 이미 활성화된 경우 예외
        if (Boolean.TRUE.equals(kiosk.getIsActive())) {
            throw new KioskException(KioskExceptionType.ALEADY_ACTIVE_KIOSK);
        }

        kiosk.setIsActive(true);
        kioskRepository.save(kiosk);

        return new ActivateKioskResponse(admin.getId(), kiosk.getId());
    }

    @Transactional
    public int deactivateKioskByNumber(Long kioskId) {
        Kiosk kiosk = kioskRepository.findById(kioskId)
                .orElseThrow(() -> new KioskException(KioskExceptionType.KIOSK_NOT_FOUND));

        kiosk.setIsActive(false);

        return kiosk.getKioskNumber();
    }

}
