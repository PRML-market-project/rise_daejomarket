package com.mallang.mallnagorder.kiosk.control;

import org.springframework.stereotype.Component;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Component
public class WindowsShutdownLauncher {
    public void launch(Path root) throws IOException, InterruptedException {
        Path logs = root.resolve(".local-service-logs");
        Files.createDirectories(logs);
        Process process = start(new ProcessBuilder(command(root)).directory(root.toFile())
                .redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.appendTo(logs.resolve("admin-shutdown-launch.log").toFile())));
        // This short-lived launcher detaches the shutdown worker before exiting. The worker waits
        // for this launcher to exit, so stop-windows.ps1 does not protect the backend's ancestors.
        if (!process.waitFor(8, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IOException("종료 작업을 시작하는 데 시간이 초과되었습니다.");
        }
        if (process.exitValue() != 0) throw new IOException("종료 작업을 시작하지 못했습니다.");
    }

    Process start(ProcessBuilder builder) throws IOException { return builder.start(); }

    static List<String> command(Path root) {
        Path powershell = Path.of(System.getenv().getOrDefault("SystemRoot", "C:\\Windows"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
        return List.of(powershell.toString(), "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass",
                "-File", root.resolve("scripts/request-stop-windows.ps1").toString());
    }
}
