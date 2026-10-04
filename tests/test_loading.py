#
# e2e tests based on console logs that do this:
#
# 1. checks if the scene elements are loaded 
# 2. sets maximum speed in the slider and plays back each animation
# 3. checks animation is finished
#
# Expect 284 seconds of running time.
# 
# How to install required sw for testing:
#   cd wirexrk # root directory of this repo
#   python -mvenv testing
#   source testing/bin/activate
#   pip install -r requirements.txt
#   playwright firefox
# 
# Hot to run:
#   cd wirexrk
#   python -mhttp.server # defaults to port 8000 used by tests
#   pytest tests/test_loading.py
#


# Set to True if you do not want to see the animations while tests are run
HEADLESS = True

from playwright.sync_api import sync_playwright, expect, TimeoutError as PlaywrightTimeoutError
import pytest
import os

# Define test cases with different URLs and timeouts
# Paths are relative to the BASE_URL which will be configured
# Times in ms asuming maximum speed selected for animation
test_cases = [
    ("/demos/ping", 5000, "ping_demo"),
    ("/demos/ping2", 7000, "ping2"),
    ("/demos/traceroute", 10000, "traceroute"),
    ("/demos/traceroute2", 7000, "traceroute2"),
    ("/demos/switches", 12000, "switches"), # Corrected typo from "swithces"
    ("/demos/tcp", 20000, "tcp"),
    ("/demos/tcp-e2e", 7000, "tcp-e2e"),
    ("/demos/dns", 12000, "dns"),
    ("/demos/dns-e2e", 7000, "dns-e2e"),
    ("/demos/http", 40000, "http"),
    ("/demos/vlan", 7000, "vlan"),
    ("/demos/vxlan", 7000, "vxlan"),
    ("/demos/vxlan2", 20000, "vxlan2"),
    ("/demos-with-2-networks/dns-2networks", 12000, "dns-2networks"),
    ("/demos-with-2-networks/tcp-2networks", 20000, "tcp-2networks"),
    ("/demos-with-2-networks/vxlan-2networks", 7000, "vxlan-2networks"),
]

@pytest.mark.parametrize("page_path, animation_timeout, test_id", test_cases)
def test_e2e_animation(page_path, animation_timeout, test_id):
    with sync_playwright() as p:
        # Determine if running in a CI environment to set headless mode
        is_ci_environment = os.environ.get('CI', 'false').lower() == 'true' or \
                            os.environ.get('GITLAB_CI', 'false').lower() == 'true'

        # Launch browser: headless in CI, visible locally if HEADLESS==False
        browser = p.firefox.launch(headless=(is_ci_environment or HEADLESS))
        page = browser.new_page()
        
        # Capture console.log in logs variable
        page.set_viewport_size({"width": 1280, "height": 800})
        logs = []
        page.on("console", lambda msg: logs.append(msg.text))
        
        # Construct the full URL
        base_url = os.environ.get('BASE_URL', 'http://localhost:8000')
        full_page_url = f"{base_url.rstrip('/')}{page_path}"
        
        # Navigate to the page
        page.goto(full_page_url)
        
        # Wait for the network to be idle before checking the elements of
        # the scene have been loaded
        page.wait_for_load_state("networkidle", timeout=10000)
        
        
        # Check a-frame network elements, infoPanel and buttons have been loaded.
        assert any("Network A-Frame entities in network-entity.html loaded successfully" in log_entry for log_entry in logs), \
            f"Log 'Network A-Frame entities in network-entity.html loaded successfully' not found. Captured logs: {logs}"
        assert any("HTML info panel added to the scene" in log_entry for log_entry in logs), \
            f"Log 'HTML info panel added to the scene' not found. Captured logs: {logs}"
        assert any("GUI panel added to the" in log_entry for log_entry in logs), \
            f"Log 'GUI panel added to the scene' not found. Captured logs: {logs}"


        # Set slider to maximum value so the test takes less time
        page.evaluate("""
            const slider = document.getElementById('slider');
            if (slider) {
                // Set the value to maximum
                slider.value = 100;
                
                // Create and dispatch input event
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Create and dispatch change event
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        """)
        
        # Click on playPauseButton to start animation
        page.evaluate("document.getElementById('playPauseButton').click()")

        # Check animation has finished
        # Specifically wait for the "Animation is finished" log message and fail otherwise.
        # The page.on("console") handler will add it to the `logs` list when it appears.
        try:
            with page.expect_console_message(
                lambda msg: "Animation is finished" in msg.text,
                timeout=animation_timeout  # Use parameterized timeout
            ):
                # This block is entered when the message is detected.
                # No specific action needed here if we're just waiting.
                pass
        except PlaywrightTimeoutError:
            pytest.fail(f"Timeout waiting for 'Animation is finished' log. Captured logs so far: {logs}")


        browser.close()
        
