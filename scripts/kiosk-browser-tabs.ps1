# Close only native browser tabs carrying the marker set by the local 5173 app.
# No focus, key injection, profile changes, remote debugging, or whole-browser kill.
function Test-KioskBrowserTabTitle {
    param([string] $Title)
    return $Title -and $Title.StartsWith('[DAEJO:5173] ', [StringComparison]::Ordinal)
}

function Get-KioskBrowserTabs {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $browserIds = @{}
    foreach ($browserProcess in Get-Process -Name chrome,msedge -ErrorAction SilentlyContinue) {
        $browserIds[$browserProcess.Id] = $true
    }
    if ($browserIds.Count -eq 0) { return }
    $windowCondition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Window)
    $tabCondition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::TabItem)
    $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
        [System.Windows.Automation.TreeScope]::Children, $windowCondition)
    foreach ($window in $windows) {
        try {
            if (-not $browserIds.ContainsKey($window.Current.ProcessId)) { continue }
            foreach ($tab in $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $tabCondition)) {
                if (Test-KioskBrowserTabTitle $tab.Current.Name) { Write-Output -NoEnumerate $tab }
            }
        } catch [System.Windows.Automation.ElementNotAvailableException] {
            # The dedicated kiosk browser may already be closing.
        }
    }
}

function Close-KioskBrowserTab {
    param($Tab)
    # Recheck the live title: the user may have navigated the tab since enumeration.
    if (-not (Test-KioskBrowserTabTitle $Tab.Current.Name)) { return $false }
    $buttonCondition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Button)
    foreach ($button in $Tab.FindAll([System.Windows.Automation.TreeScope]::Descendants, $buttonCondition)) {
        if ($button.Current.Name -notmatch '^(Close|Close tab|\uB2EB\uAE30|\uD0ED \uB2EB\uAE30)$') { continue }
        $invoke = $null
        if ($button.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref] $invoke)) {
            $invoke.Invoke()
            return $true
        }
    }
    return $false
}

function Close-KioskBrowserTabs {
    $closed = 0
    try {
        # Reverse order keeps the remaining tab positions stable as tabs disappear.
        $tabs = @(Get-KioskBrowserTabs)
        [array]::Reverse($tabs)
        foreach ($tab in $tabs) {
            try {
                if (-not (Test-KioskBrowserTabTitle $tab.Current.Name)) { continue }
                if (Close-KioskBrowserTab $tab) { $closed++ }
                else { Write-Warning 'A kiosk tab did not expose a close action. Refresh that tab once before shutdown.' }
            } catch [System.Windows.Automation.ElementNotAvailableException] {
                # Another shutdown action already closed this tab.
            } catch {
                Write-Warning "Could not close a kiosk tab: $($_.Exception.Message)"
            }
        }
    } catch {
        Write-Warning "Could not inspect kiosk browser tabs: $($_.Exception.Message)"
    }
    Write-Host "Closed $closed local kiosk browser tab(s)."
}
