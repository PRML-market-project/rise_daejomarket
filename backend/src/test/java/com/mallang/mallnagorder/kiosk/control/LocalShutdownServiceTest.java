package com.mallang.mallnagorder.kiosk.control;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.IOException;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LocalShutdownServiceTest {
    @TempDir Path temporary;
    Path project() throws IOException {
        Path root = Files.createDirectories(temporary.resolve("kiosk project"));
        Files.createDirectories(root.resolve("scripts")); Files.createDirectories(root.resolve("backend"));
        for (var file : new String[] {"end.cmd", "scripts/stop-windows.ps1", "scripts/request-stop-windows.ps1"}) Files.writeString(root.resolve(file), "test");
        return root;
    }
    @Test void findsRootFromBackendAndFailsClosedWithoutScripts() throws Exception {
        Path root = project();
        assertThat(LocalShutdownService.findProjectRoot(root.resolve("backend"))).isEqualTo(root.toRealPath());
        assertThatThrownBy(() -> LocalShutdownService.findProjectRoot(temporary.resolve("unrelated"))).isInstanceOf(IOException.class);
    }
    @Test void onlyLaunchesOnceAndAllowsRetryAfterFailure() throws Exception {
        assumeTrue(System.getProperty("os.name").startsWith("Windows"));
        var launcher = mock(WindowsShutdownLauncher.class); var root = project();
        var service = new LocalShutdownService(launcher, root.toString());
        doThrow(new IOException("first launch failed")).doNothing().when(launcher).launch(any());
        assertThatThrownBy(service::shutdown).isInstanceOf(IOException.class);
        service.shutdown(); service.shutdown();
        verify(launcher, times(2)).launch(root.toRealPath());
    }
    @Test void launchesFixedScriptWithoutShellInterpolationAndChecksExitCode() throws Exception {
        var root = project(); var process = mock(Process.class);
        when(process.waitFor(8, TimeUnit.SECONDS)).thenReturn(true); when(process.exitValue()).thenReturn(0);
        var launcher = spy(new WindowsShutdownLauncher()); doReturn(process).when(launcher).start(any());
        launcher.launch(root);
        var captor = org.mockito.ArgumentCaptor.forClass(ProcessBuilder.class); verify(launcher).start(captor.capture());
        assertThat(captor.getValue().command()).containsSubsequence("-WindowStyle", "Hidden").endsWith("-File", root.resolve("scripts/request-stop-windows.ps1").toString());
        assertThat(captor.getValue().directory().toPath()).isEqualTo(root);
        when(process.exitValue()).thenReturn(1);
        assertThatThrownBy(() -> launcher.launch(root)).isInstanceOf(IOException.class);
    }
}
