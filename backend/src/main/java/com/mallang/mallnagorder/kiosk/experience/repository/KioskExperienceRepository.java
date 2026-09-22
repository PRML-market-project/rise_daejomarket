package com.mallang.mallnagorder.kiosk.experience.repository;

import com.mallang.mallnagorder.kiosk.experience.domain.KioskExperience;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KioskExperienceRepository extends JpaRepository<KioskExperience, Long> {
}
