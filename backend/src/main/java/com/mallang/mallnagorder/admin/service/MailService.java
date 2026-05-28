package com.mallang.mallnagorder.admin.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;

@Slf4j
@Service
@RequiredArgsConstructor
public class MailService {

    private final JavaMailSender mailSender;

    //인증 메일 생성
    public MimeMessage createEmailForm(String email, String authNum) throws MessagingException{

        String fromEmail = "noreply.mallangorder@gmail.com"; //보내는 사람
        String toEmail  = email; // 받는 사람
        String title = "Mallang-Order 회원가입 인증"; //메일 제목

        MimeMessage message = mailSender.createMimeMessage();
        message.addRecipients(MimeMessage.RecipientType.TO, toEmail); // 받는 사람 설정
        message.setSubject(title); // 제목 설정

        //메일 내용 설정
        String msgOfEmail="";
        msgOfEmail += "<div style='margin:20px;'>";
        msgOfEmail += "<h1> 안녕하세요 Mallang-Order 입니다. </h1>";
        msgOfEmail += "<br>";
        msgOfEmail += "<p>아래 코드를 입력해주세요<p>";
        msgOfEmail += "<br>";
        msgOfEmail += "<p>감사합니다.<p>";
        msgOfEmail += "<br>";
        msgOfEmail += "<div align='center' style='border:1px solid black; font-family:verdana';>";
        msgOfEmail += "<h3 style='color:blue;'>회원가입 인증 코드입니다.</h3>";
        msgOfEmail += "<div style='font-size:130%'>";
        msgOfEmail += "CODE : <strong>";
        msgOfEmail += authNum + "</strong><div><br/> ";
        msgOfEmail += "</div>";

        message.setFrom(fromEmail);		// 보내는 사람 설정
        message.setText(msgOfEmail, "utf-8", "html"); //내용 설정

        return message;
    }

    //인증 메일 발송
    public void sendMail(String email, String authNum) throws MessagingException, UnsupportedEncodingException {

        //메일 전송 정보 설정
        MimeMessage emailForm = createEmailForm(email, authNum);

        mailSender.send(emailForm);
    }
}
