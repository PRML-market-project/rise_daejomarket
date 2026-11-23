# Tests only fake accessibility elements. Never enumerate or close real browser tabs.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
. (Join-Path $PSScriptRoot '..\kiosk-browser-tabs.ps1')

function Assert-True($Condition, [string] $Message) {
    if (-not $Condition) { throw $Message }
}

Assert-True (Test-KioskBrowserTabTitle '[DAEJO:5173] kiosk') 'Local kiosk title should match.'
foreach ($title in @('', 'localhost', 'Other site', '[DAEJO:51730] kiosk', 'Other [DAEJO:5173] kiosk', '[DAEJO:3000] admin')) {
    Assert-True (-not (Test-KioskBrowserTabTitle $title)) "Unrelated title should remain open: $title"
}

$script:invocations = 0
function New-FakeButton([string] $Name) {
    $action = [pscustomobject]@{}
    $action | Add-Member ScriptMethod Invoke { $script:invocations++ }
    $button = [pscustomobject]@{ Current = [pscustomobject]@{ Name = $Name }; Action = $action }
    $button | Add-Member ScriptMethod TryGetCurrentPattern {
        param($Pattern, $Output)
        $Output.Value = $this.Action
        return $true
    }
    return $button
}

function New-FakeTab([string] $Name, $Buttons) {
    $tab = [pscustomobject]@{ Current = [pscustomobject]@{ Name = $Name }; Buttons = $Buttons }
    $tab | Add-Member ScriptMethod FindAll { param($Scope, $Condition) return $this.Buttons }
    return $tab
}

$close = New-FakeButton 'Close tab'
$mute = New-FakeButton 'Mute tab'
$tab = New-FakeTab '[DAEJO:5173] kiosk' @($mute, $close)
Assert-True (Close-KioskBrowserTab $tab) 'Expected the tab close action to run.'
Assert-True ($script:invocations -eq 1) 'Only the close button should be invoked.'

$koreanClose = New-FakeButton ([char]0xB2EB + [string][char]0xAE30)
Assert-True (Close-KioskBrowserTab (New-FakeTab '[DAEJO:5173] admin' @($koreanClose))) 'Korean close action should work.'
Assert-True ($script:invocations -eq 2) 'Expected Korean close button invocation.'

Assert-True (-not (Close-KioskBrowserTab (New-FakeTab 'Other site' @($close)))) 'Navigated tabs must remain open.'
Assert-True (-not (Close-KioskBrowserTab (New-FakeTab '[DAEJO:5173] kiosk' @($mute)))) 'Do not invoke unrelated actions.'
Assert-True ($script:invocations -eq 2) 'No unrelated button should be invoked.'

$script:closedTitles = @()
function Get-KioskBrowserTabs {
    foreach ($name in @('[DAEJO:5173] kiosk', 'Other site', '[DAEJO:5173] admin')) {
        New-FakeTab $name @()
    }
}
function Close-KioskBrowserTab { param($Tab) $script:closedTitles += $Tab.Current.Name; return $true }
Close-KioskBrowserTabs
Assert-True ($script:closedTitles.Count -eq 2) 'All kiosk tabs should close.'
Assert-True ($script:closedTitles -notcontains 'Other site') 'Unrelated tabs must remain open.'
Write-Host 'Kiosk browser tab tests passed.'
