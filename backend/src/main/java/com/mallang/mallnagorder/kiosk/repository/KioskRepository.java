package com.mallang.mallnagorder.kiosk.repository;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.kiosk.domain.Kiosk;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KioskRepository extends JpaRepository<Kiosk, Long> {

    List<Kiosk> findByAdmin(Admin admin);

    List<Kiosk> findAllByAdmin(Admin admin);

    Optional<Kiosk> findByAdminIdAndKioskNumber(Long adminId, int kioskNumber);

    List<Kiosk> findAllByAdminId(Long adminId);

}
