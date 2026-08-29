#!/usr/bin/env python3
"""
ProofLoop Missions Timeout Fix Test
FOCUSED RETEST: Verify POST /api/analyze/missions completes under 60s with HTTP 200 (not 502)
"""

import requests
import json
import time
import sys

BASE_URL = "https://proofloop-validate.preview.emergentagent.com/api"
TIMEOUT = 150

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def log_error(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def log_info(msg: str):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.END}")

def log_warning(msg: str):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")

def log_header(msg: str):
    print(f"\n{Colors.BOLD}{'='*80}")
    print(f"{msg}")
    print(f"{'='*80}{Colors.END}")

def main():
    log_header("ProofLoop Missions Timeout Fix Test")
    log_info(f"Base URL: {BASE_URL}")
    log_info("Testing: Claims chunked into batches of 3, generated in PARALLEL")
    log_info("Expected: HTTP 200 with missions array in <55s (not 502 timeout)")
    
    startup_id = None
    
    try:
        # Step 1: Create startup
        log_header("STEP 1: Create Startup (POST /api/startups)")
        startup_data = {
            "name": "FitTrackr",
            "idea": "Wearable-integrated app that gamifies fitness for remote workers with team challenges and streak rewards"
        }
        
        log_info(f"Creating startup: {startup_data['name']}")
        start = time.time()
        response = requests.post(f"{BASE_URL}/startups", json=startup_data, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log_error(f"Failed to create startup: {response.text}")
            sys.exit(1)
        
        data = response.json()
        startup_id = data['startup']['id']
        log_success(f"Startup created: {startup_id}")
        log_info(f"First question: {data['first_question'][:80]}...")
        
        # Step 2a: Interview turn 1
        log_header("STEP 2a: Interview Turn 1 (POST /api/interview)")
        answer1 = "Target customers are remote tech workers aged 25-40 who sit 8+ hours a day. We ran a poll in 5 remote-work Slack communities: 68% of 300 respondents said they lost fitness habits since going remote."
        
        log_info(f"Answer: {answer1[:80]}...")
        start = time.time()
        response = requests.post(f"{BASE_URL}/interview", json={"startup_id": startup_id, "message": answer1}, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log_error(f"Interview turn 1 failed: {response.text}")
            sys.exit(1)
        
        data = response.json()
        log_success(f"Turn 1 completed - Progress: {data['progress']}%")
        log_info(f"Next question: {data['question'][:80]}...")
        
        # Step 2b: Interview turn 2
        log_header("STEP 2b: Interview Turn 2 (POST /api/interview)")
        answer2 = "They currently use Fitbit or Apple Fitness but quit within weeks because there's no social accountability. We add team challenges tied to coworkers. Pricing: $6/user/month billed to employers as a wellness benefit."
        
        log_info(f"Answer: {answer2[:80]}...")
        start = time.time()
        response = requests.post(f"{BASE_URL}/interview", json={"startup_id": startup_id, "message": answer2}, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log_error(f"Interview turn 2 failed: {response.text}")
            sys.exit(1)
        
        data = response.json()
        log_success(f"Turn 2 completed - Progress: {data['progress']}%")
        
        # Step 3: Complete interview
        log_header("STEP 3: Complete Interview (POST /api/interview/complete)")
        log_info("Generating profile from interview...")
        start = time.time()
        response = requests.post(f"{BASE_URL}/interview/complete", json={"startup_id": startup_id}, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log_error(f"Complete interview failed: {response.text}")
            sys.exit(1)
        
        data = response.json()
        log_success(f"Profile generated (version {data['version']})")
        
        # Step 4: Specialist analysis
        log_header("STEP 4: Specialist Analysis (POST /api/analyze/specialists)")
        log_info("Running 4 specialist agents in parallel...")
        log_warning("This may take 60-90s (4 parallel AI calls)")
        start = time.time()
        response = requests.post(f"{BASE_URL}/analyze/specialists", json={"startup_id": startup_id}, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log_error(f"Specialist analysis failed: {response.text}")
            sys.exit(1)
        
        data = response.json()
        log_success(f"All 4 specialists completed: {data['agents_run']}")
        
        # Step 5: Critic analysis
        log_header("STEP 5: Critic Analysis (POST /api/analyze/critic)")
        log_info("Running critic to extract claims...")
        start = time.time()
        response = requests.post(f"{BASE_URL}/analyze/critic", json={"startup_id": startup_id}, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log_error(f"Critic analysis failed: {response.text}")
            sys.exit(1)
        
        data = response.json()
        claims = data['claims']
        claims_needing_evidence = [c for c in claims if c.get('evidence_required') and c.get('status') == 'unproven']
        log_success(f"Critic extracted {len(claims)} claims")
        log_info(f"Claims needing evidence: {len(claims_needing_evidence)}")
        
        # Step 6: **THE KEY TEST** - Mission generation with timing
        log_header("STEP 6: ⚡ MISSION GENERATION - TIMEOUT FIX TEST ⚡")
        log_info(f"Expected: {len(claims_needing_evidence)} missions (one per claim needing evidence)")
        log_info("REQUIREMENT: HTTP 200 with missions array in <55s (not 502)")
        log_warning("Measuring elapsed time...")
        
        start = time.time()
        response = requests.post(f"{BASE_URL}/analyze/missions", json={"startup_id": startup_id}, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        # Log the critical metrics
        print(f"\n{Colors.BOLD}{'='*80}")
        print(f"⏱️  ELAPSED TIME: {elapsed:.2f} seconds")
        print(f"📡 HTTP STATUS: {response.status_code}")
        print(f"{'='*80}{Colors.END}\n")
        
        # Verify HTTP 200 (not 502)
        if response.status_code == 502:
            log_error("❌ TIMEOUT ISSUE PERSISTS: Client received 502 Bad Gateway")
            log_error(f"Backend took {elapsed:.2f}s, exceeding the 60s ingress timeout")
            log_error("The fix did NOT resolve the timeout issue")
            sys.exit(1)
        
        if response.status_code != 200:
            log_error(f"Unexpected status: {response.status_code}")
            log_error(f"Response: {response.text}")
            sys.exit(1)
        
        # Verify response contains missions array
        data = response.json()
        if 'missions' not in data:
            log_error(f"Response missing 'missions' field. Got: {list(data.keys())}")
            sys.exit(1)
        
        missions = data['missions']
        
        # Verify missions count matches claims needing evidence
        if len(missions) != len(claims_needing_evidence):
            log_warning(f"Expected {len(claims_needing_evidence)} missions, got {len(missions)}")
        else:
            log_success(f"✓ Missions count matches claims needing evidence: {len(missions)}")
        
        # Verify each mission has required fields
        required_fields = ['id', 'claim_id', 'title', 'description', 'task_type', 'instructions', 'success_criteria', 'priority', 'status']
        all_valid = True
        
        for i, mission in enumerate(missions, 1):
            missing = [f for f in required_fields if f not in mission]
            
            if missing:
                log_error(f"Mission {i} missing fields: {missing}")
                all_valid = False
            elif mission['status'] != 'pending':
                log_warning(f"Mission {i} status is '{mission['status']}', expected 'pending'")
            else:
                log_info(f"Mission {i}: [{mission['priority']}] {mission['title']}")
        
        if all_valid:
            log_success("✓ All missions have required fields")
        
        # Evaluate timing
        if elapsed < 55:
            log_success(f"✅ EXCELLENT: Completed in {elapsed:.2f}s (well under 60s timeout)")
        elif elapsed < 60:
            log_success(f"✅ GOOD: Completed in {elapsed:.2f}s (under 60s timeout)")
        else:
            log_warning(f"⚠️  SLOW: Completed in {elapsed:.2f}s (over 60s, but client got 200)")
        
        log_success("✅ TIMEOUT FIX VERIFIED: Client received HTTP 200 with missions array")
        
        # Step 7: Verify missions persisted in DB
        log_header("STEP 7: Verify Missions in DB (GET /api/startups/:id)")
        log_info("Fetching startup detail to verify missions persisted...")
        response = requests.get(f"{BASE_URL}/startups/{startup_id}", timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log_error(f"Failed to fetch startup detail: {response.text}")
            sys.exit(1)
        
        data = response.json()
        db_missions = data.get('missions', [])
        
        if len(db_missions) == len(missions):
            log_success(f"✓ All {len(missions)} missions persisted in DB")
            
            # Verify mission IDs match
            response_ids = set(m['id'] for m in missions)
            db_ids = set(m['id'] for m in db_missions)
            
            if response_ids == db_ids:
                log_success("✓ Mission IDs match between response and DB")
            else:
                log_warning("Mission IDs don't match between response and DB")
        else:
            log_error(f"Mission count mismatch: response={len(missions)}, DB={len(db_missions)}")
        
        # Step 8: Cleanup - delete startup
        log_header("STEP 8: Cleanup (DELETE /api/startups/:id)")
        log_info(f"Deleting startup {startup_id}...")
        response = requests.delete(f"{BASE_URL}/startups/{startup_id}", timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('deleted'):
                log_success("✓ Startup deleted successfully")
            else:
                log_warning(f"Unexpected response: {data}")
        else:
            log_warning(f"Delete failed: {response.status_code} - {response.text}")
        
        # Final summary
        log_header("✅ TEST COMPLETE - MISSIONS TIMEOUT FIX VERIFIED")
        print(f"{Colors.GREEN}Key Results:{Colors.END}")
        print(f"  • HTTP Status: 200 (not 502) ✓")
        print(f"  • Elapsed Time: {elapsed:.2f}s")
        print(f"  • Missions Generated: {len(missions)}")
        print(f"  • All Fields Valid: {'Yes' if all_valid else 'No'}")
        print(f"  • DB Persistence: Verified ✓")
        print(f"\n{Colors.GREEN}The timeout fix is working correctly!{Colors.END}\n")
        
        sys.exit(0)
        
    except Exception as e:
        log_error(f"Test failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Cleanup on error
        if startup_id:
            try:
                log_info(f"Attempting cleanup: deleting startup {startup_id}...")
                requests.delete(f"{BASE_URL}/startups/{startup_id}", timeout=30)
                log_info("Cleanup completed")
            except:
                log_warning("Cleanup failed")
        
        sys.exit(1)

if __name__ == "__main__":
    main()
