package com.mallang.mallnagorder.admin.service;

import com.mallang.mallnagorder.admin.domain.Admin;
import com.mallang.mallnagorder.admin.dto.CheckResponse;
import com.mallang.mallnagorder.admin.dto.EmailCheckRequest;
import com.mallang.mallnagorder.admin.dto.JoinRequest;
import com.mallang.mallnagorder.admin.dto.StoreInfoResponse;
import com.mallang.mallnagorder.admin.exception.AdminException;
import com.mallang.mallnagorder.admin.exception.AdminExceptionType;
import com.mallang.mallnagorder.admin.repository.AdminRepository;
import com.mallang.mallnagorder.category.domain.Category;
import com.mallang.mallnagorder.category.dto.CategoryResponse;
import com.mallang.mallnagorder.category.repository.CategoryRepository;
import com.mallang.mallnagorder.kiosk.domain.Kiosk;
import com.mallang.mallnagorder.kiosk.repository.KioskRepository;
import com.mallang.mallnagorder.menu.domain.Menu;
import com.mallang.mallnagorder.menu.dto.MenuResponse;
import com.mallang.mallnagorder.menu.repository.MenuRepository;
import com.mallang.mallnagorder.order.dto.response.OrderResponse;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private final AdminRepository adminRepository;
    private final BCryptPasswordEncoder bCryptPasswordEncoder;
    private final CategoryRepository categoryRepository;
    private final KioskRepository kioskRepository;
    private final MenuRepository menuRepository;


    public AdminService(AdminRepository adminRepository, BCryptPasswordEncoder bCryptPasswordEncoder, CategoryRepository categoryRepository, KioskRepository kioskRepository, MenuRepository menuRepository) {
        this.adminRepository = adminRepository;
        this.bCryptPasswordEncoder = bCryptPasswordEncoder;
        this.categoryRepository = categoryRepository;
        this.kioskRepository = kioskRepository;
        this.menuRepository = menuRepository;
    }

    /*
    관리자 생성
     */

    // 이메일 체크 - 테스트 완료
    public void emailValidate(EmailCheckRequest emailCheckRequest) throws AdminException {
        String email = emailCheckRequest.getEmail();

        // 이메일 중복 체크
        if(adminRepository.existsByEmail(email)){
            throw new AdminException(AdminExceptionType.ALREADY_EXIST_EMAIL);
        }

        // 이메일 형식 체크
        checkEmailValid(email);
    }

    // 회원가입 - 영어 가게 이름 추가
    public Long join(JoinRequest joinRequest) {
        String email = joinRequest.getEmail();
        String password = joinRequest.getPassword();
        String adminName = joinRequest.getAdminName();
        String storeName = joinRequest.getStoreName();
        String storeNameEn = joinRequest.getStoreNameEn();

        // 비밀번호 형식 체크
        checkPasswordValid(password);

        Admin admin = new Admin();
        admin.setEmail(email);
        admin.setPassword(bCryptPasswordEncoder.encode(password)); // 비밀번호 암호화
        admin.setAdminName(adminName);
        admin.setStoreName(storeName);
        admin.setStoreNameEn(storeNameEn);

        // 회원 정보를 DB에 저장하고, 저장된 객체 반환
        Admin savedAdmin = adminRepository.save(admin);

        // 기본 카테고리 생성
        createDefaultCategoryIfNotExists(savedAdmin);

        // 디버깅 로그 추가
        System.out.println("Saved Admin ID: " + savedAdmin.getId());

        return savedAdmin.getId();
    }

    private void createDefaultCategoryIfNotExists(Admin admin) {
        if (!categoryRepository.existsByCategoryNameAndAdminId("전체", admin.getId())) {
            Category defaultCategory = Category.builder()
                    .categoryName("전체")
                    .categoryNameEn("All")
                    .adminId(admin.getId())
                    .menuCategories(new ArrayList<>())
                    .build();
            categoryRepository.save(defaultCategory);
        }
    }


    /*
    관리자 수정
     */

    // 관리자 이름 변경 - 테스트 완료
    public CheckResponse changeAdminName(String email, String newName) throws AdminException {

        // 이메일로 회원 찾기
         Admin admin = adminRepository.findByEmail(email)
                 .orElseThrow(()-> new AdminException(AdminExceptionType.ADMIN_NOT_EXIST));

        // 새로운 이름으로 변경
        admin.setAdminName(newName);
        adminRepository.save(admin); // 변경된 이름을 DB에 저장

        return new CheckResponse(true, "사장님 이름이 성공적으로 변경되었습니다.");
    }

    // 상점 이름 변경
    public CheckResponse changeStoreName(String email, String newName, String newNameEn) throws AdminException {

        // 이메일로 회원 찾기
        Admin admin = adminRepository.findByEmail(email)
                .orElseThrow(()-> new AdminException(AdminExceptionType.ADMIN_NOT_EXIST));

        // 상점 이름 중복 확인 한글, 영문
        if (adminRepository.existsByStoreNameAndIdNot(newName, admin.getId())) {
            throw new AdminException(AdminExceptionType.ALREADY_EXIST_STORENAME);
        }
        if (adminRepository.existsByStoreNameEnAndIdNot(newNameEn, admin.getId())) {
            throw new AdminException(AdminExceptionType.ALREADY_EXIST_STORENAME_EN);
        }

        // 새로운 이름으로 변경
        admin.setStoreName(newName);
        admin.setStoreNameEn(newNameEn);

        // 변경된 이름을 DB에 저장
        adminRepository.save(admin);

        return new CheckResponse(true, "가게 이름이 성공적으로 변경되었습니다.");
    }

    // 비밀번호 변경 - 테스트 완료
    public CheckResponse changePassword(String email, String oldPassword, String newPassword) throws AdminException {

        // 이메일로 회원 찾기
        Admin admin = adminRepository.findByEmail(email)
                .orElseThrow(()-> new AdminException(AdminExceptionType.ADMIN_NOT_EXIST));


        // 기존 비밀번호 확인
        if (!bCryptPasswordEncoder.matches(oldPassword, admin.getPassword())) {
            throw new AdminException(AdminExceptionType.ADMIN_WRONG_PASSWORD); // 기존 비밀번호가 틀린 경우
        }

        // 변경 비밀번호 형식 체크
        checkPasswordValid(newPassword);

        // 새로운 비밀번호로 변경 (암호화하여 저장)
        admin.setPassword(bCryptPasswordEncoder.encode(newPassword));

        // 변경된 비밀번호를 DB에 저장
        adminRepository.save(admin);

        // 성공 메시지 반환
        return new CheckResponse(true, "비밀번호가 성공적으로 변경되었습니다.");
    }

    // 회원 삭제 - 테스트 완료
    @Transactional
    public CheckResponse deleteAdmin(String email, String password) throws AdminException {

        // 이메일로 회원 찾기
        Admin admin = adminRepository.findByEmail(email)
                .orElseThrow(()-> new AdminException(AdminExceptionType.ADMIN_NOT_EXIST));

        // 비밀번호 확인
        if (!bCryptPasswordEncoder.matches(password, admin.getPassword())) {
            throw new AdminException(AdminExceptionType.ADMIN_WRONG_PASSWORD); // 비밀번호가 맞지 않으면 예외
        }

        // 회원 삭제
        adminRepository.delete(admin);

        // 성공적으로 삭제되었음을 알리는 메시지 반환
        return new CheckResponse(true, "관리자가 성공적으로 삭제되었습니다.");
    }


    /*
    유효성 검사
     */

    private void checkEmailValid(String email) {
        // 이메일 유효성 검사 정규표현식
        String EMAIL_FORMAT = "^[a-zA-Z0-9_+&*-]+(?:\\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,7}$";

        if(email == null || !email.matches(EMAIL_FORMAT)){
            throw new AdminException(AdminExceptionType.INVALID_EMAIL_FORMAT);
        }
    }

    private void checkPasswordValid(String password) {
        // 사용자 비밀번호는 영문, 숫자, 하나 이상의 특수문자를 포함하는 8 ~ 16자
        String PASSWORD_FORMAT = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[~!@#$%^&*()+|=])[A-Za-z\\d~!@#$%^&*()+|=]{8,16}$";

        if (password == null ||!password.matches(PASSWORD_FORMAT)){
            throw new AdminException(AdminExceptionType.INVALID_PASSWORD_FORMAT);
        }
    }

    // 가게이름 중복 검사
    public CheckResponse checkStoreName(String storeName, String storeNameEn) throws AdminException {
        if (adminRepository.existsByStoreName(storeName)){
            throw new AdminException(AdminExceptionType.ALREADY_EXIST_STORENAME);
        }
        if (adminRepository.existsByStoreNameEn(storeNameEn)){
            throw new AdminException(AdminExceptionType.ALREADY_EXIST_STORENAME_EN);
        }
        return new CheckResponse(true, "사용 가능한 가게 이름입니다.");
    }


    /*
    관리자 조회
     */

    public StoreInfoResponse getStoreInfo(Long adminId) {
        Admin admin = adminRepository.findById(adminId)
                .orElseThrow(()-> new AdminException(AdminExceptionType.ADMIN_NOT_EXIST));

        return new StoreInfoResponse(
                admin.getEmail(),
                admin.getAdminName(),
                admin.getStoreName(),
                admin.getStoreNameEn(),
                admin.getKiosks() != null ? admin.getKiosks().size() : 0
        );
    }

    public List<CategoryResponse> getCategories(Long adminId) {
        List<Category> categories = categoryRepository.findByAdminId(adminId);
        return categories.stream()
                .map(CategoryResponse::from)
                .toList();
    }


    public List<MenuResponse> getMenus(Long adminId) {
        List<Menu> menus = menuRepository.findByAdminId(adminId);
        return menus.stream()
                .map(MenuResponse::from)
                .toList();
    }


    // 관리자 주문 조회
    private final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public List<OrderResponse> getOrders(Long adminId) {
        List<Kiosk> kiosks = kioskRepository.findAllByAdminId(adminId);

        return kiosks.stream()
                .map(kiosk -> {
                    List<OrderResponse.OrderSummary> orderSummaries = kiosk.getOrders().stream()
                            .map(order -> OrderResponse.OrderSummary.builder()
                                    .orderId(order.getId())
                                    .createdAt(order.getCreatedDate().format(formatter))
                                    .items(order.getOrderItems().stream()
                                            .map(item -> OrderResponse.OrderItemSummary.builder()
                                                    .menuName(item.getMenu().getMenuName())
                                                    .menuNameEn(item.getMenu().getMenuNameEn())
                                                    .menuPrice(item.getMenu().getMenuPrice())
                                                    .quantity(item.getQuantity())
                                                    .build())
                                            .collect(Collectors.toList()))
                                    .build())
                            .collect(Collectors.toList());

                    return OrderResponse.builder()
                            .kioskId(kiosk.getId())
                            .kioskNumber(kiosk.getKioskNumber())
                            .kioskIsActive(kiosk.getIsActive())
                            .orders(orderSummaries)
                            .build();
                })
                .collect(Collectors.toList());
    }


}