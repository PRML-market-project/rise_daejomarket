package com.mallang.mallnagorder.category.repository;

import com.mallang.mallnagorder.category.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    boolean existsByCategoryNameEnAndAdminId(String categoryNameEn, Long adminId);

    Optional<Category> findByCategoryNameAndAdminId(String categoryName, Long adminId);

    Optional<Category> findByIdAndAdminId(Long categoryId, Long adminId);

    boolean existsByCategoryNameAndAdminIdAndIdNot(String name, Long adminId, Long id);
    boolean existsByCategoryNameEnAndAdminIdAndIdNot(String nameEn, Long adminId, Long id);

    @Query("SELECT DISTINCT c FROM Category c LEFT JOIN FETCH c.menuCategories mc LEFT JOIN FETCH mc.menu WHERE c.adminId = :adminId")
    List<Category> findAllWithMenusByAdminId(@Param("adminId") Long adminId);

    @Query("SELECT DISTINCT c.adminId FROM Category c")
    List<Long> findAllAdminIds();

    List<Category> findByAdminId(Long adminId);
    boolean existsByCategoryNameAndAdminId(String name, Long adminId);

}
