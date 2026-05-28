package com.mallang.mallnagorder.admin.repository;

import com.mallang.mallnagorder.admin.domain.Admin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdminRepository extends JpaRepository<Admin, Long> {


    Optional<Admin> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByStoreName(String storeName);

    boolean existsByStoreNameEn(String storeNameEn);

    Optional<Admin> findByStoreName(String storeName);

    boolean existsByStoreNameAndIdNot(String storeName, Long id);

    boolean existsByStoreNameEnAndIdNot(String storeNameEn, Long id);

    @Query("SELECT a.id FROM Admin a")
    List<Long> findAllAdminIds();

}
