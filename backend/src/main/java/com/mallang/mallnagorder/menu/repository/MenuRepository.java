package com.mallang.mallnagorder.menu.repository;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.menu.domain.Menu;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MenuRepository extends JpaRepository<Menu, Long> {

    Optional<Menu> findByIdAndAdminId(Long menuId, Long adminId);

    boolean existsByMenuNameAndAdminId(String menuName, Long adminId);
    boolean existsByMenuNameEnAndAdminId(String cmenuNameEn, Long adminId);

    boolean existsByMenuNameAndAdminIdAndIdNot(String name, Long adminId, Long id);
    boolean existsByMenuNameEnAndAdminIdAndIdNot(String nameEn, Long adminId, Long id);

    List<Menu> findByAdminId(Long adminId);

}
