package com.mallang.mallnagorder.kiosk.control;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class LocalShutdownService {
    private final WindowsShutdownLauncher launcher;
    private final Path configuredRoot;
    private final AtomicBoolean requested = new AtomicBoolean();

    public LocalShutdownService(WindowsShutdownLauncher launcher, @Value("${kiosk.project-root:}") String projectRoot) {
        this.launcher = launcher;
        this.configuredRoot = projectRoot.isBlank() ? null : Path.of(projectRoot).toAbsolutePath().normalize();
    }

    public void shutdown() throws IOException, InterruptedException {
        if (!System.getProperty("os.name", "").toLowerCase(Locale.ROOT).startsWith("windows"))
            throw new UnsupportedOperationException("전체 종료는 Windows 키오스크 PC에서 사용할 수 있습니다.");
        Path root = findProjectRoot(configuredRoot == null ? Path.of(System.getProperty("user.dir")) : configuredRoot);
        if (!requested.compareAndSet(false, true)) return;
        try { launcher.launch(root); }
        catch (IOException | InterruptedException | RuntimeException error) { requested.set(false); throw error; }
    }

    static Path findProjectRoot(Path start) throws IOException {
        for (Path root = start.toAbsolutePath().normalize(); root != null; root = root.getParent()) {
            if (Files.isRegularFile(root.resolve("end.cmd")) && Files.isRegularFile(root.resolve("scripts/stop-windows.ps1"))
                    && Files.isRegularFile(root.resolve("scripts/request-stop-windows.ps1"))) return root.toRealPath();
        }
        throw new IOException("프로젝트 종료 스크립트를 찾지 못했습니다.");
    }
}
