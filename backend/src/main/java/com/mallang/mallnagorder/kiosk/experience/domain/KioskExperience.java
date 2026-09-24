package com.mallang.mallnagorder.kiosk.experience.domain;

import com.mallang.mallnagorder.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class KioskExperience extends BaseEntity {

    @Column(nullable = false, length = 20)
    private String operationMode = "DIRECTIONS";

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String promotionsJson = "[]";

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String searchTagsJson = "[]";

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String shopsJson = "[]";

    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String translationsJson = "{}";
}
