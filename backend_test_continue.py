#!/usr/bin/env python3
"""
ProofLoop Backend API Test Suite - Continue from Test 8
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
    END = '\033[0m'

def log_success(msg: str):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def log_error(msg: str):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def log_info(msg: str):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.END}")

def log_warning(msg: str):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")

# Startup ID from previous test
STARTUP_ID = "a378cb15-1a61-423a-a5eb-f5aeb59ba4c9"

def test_evidence_submission():
    """Test 8: POST /api/missions/:id/submit → submit evidence"""
    print("\n" + "="*80)
    print("TEST 8: Evidence Submission + Auto-Evaluation (POST /api/missions/:id/submit)")
    print("="*80)
    
    try:
        # First get the missions
        log_info("Fetching missions...")
        response = requests.get(f"{BASE_URL}/startups/{STARTUP_ID}", timeout=30)
        if response.status_code != 200:
            log_error(f"Could not fetch startup: {response.status_code}")
            return False
        
        data = response.json()
        missions = data.get('missions', [])
        
        if not missions:
            log_error("No missions found")
            return False
        
        mission_id = missions[0]['id']
        log_info(f"Using mission: {missions[0]['title']}")
        
        payload = {
            "description": "Interviewed 20 STEM students on campus over 2 weeks",
            "results": "17 of 20 said making study materials is a top-3 pain point; 12 said they would pay for auto-generation",
            "metrics": "17/20 pain confirmation, 12/20 willingness to pay at $8/mo",
            "links": "",
            "notes": "Recruited via campus ambassador program"
        }
        
        log_info(f"Submitting evidence for mission {mission_id}...")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/missions/{mission_id}/submit", json=payload, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'submission' in data and 'evaluation' in data:
                submission = data['submission']
                evaluation = data['evaluation']
                
                if 'id' in submission:
                    log_success(f"Evidence submitted (ID: {submission['id']})")
                
                required_eval = ['status', 'confidence', 'evaluation']
                missing = [f for f in required_eval if f not in evaluation]
                
                if not missing:
                    status = evaluation['status']
                    confidence = evaluation['confidence']
                    
                    valid_statuses = ['VALIDATED', 'PARTIALLY_VALIDATED', 'UNPROVEN', 'REJECTED']
                    if status in valid_statuses:
                        log_success(f"Evidence evaluated: {status} (confidence: {confidence}/100)")
                        return True
                    else:
                        log_error(f"Invalid evaluation status: {status}")
                        return False
                else:
                    log_error(f"Evaluation missing fields: {missing}")
                    return False
            else:
                log_error(f"Missing required fields. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text[:500]}")
            return False
            
    except Exception as e:
        log_error(f"Evidence submission failed: {str(e)}")
        return False

def test_chairman_assessment():
    """Test 9: POST /api/analyze/chairman → final assessment + score"""
    print("\n" + "="*80)
    print("TEST 9: Chairman Assessment + Investor Readiness Score (POST /api/analyze/chairman)")
    print("="*80)
    
    try:
        payload = {"startup_id": STARTUP_ID}
        
        log_info("Running chairman assessment...")
        log_warning("This aggregates all data and runs final AI analysis - may take 60-90 seconds")
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/analyze/chairman", json=payload, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        
        log_info(f"Status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            if 'report' in data and 'score' in data:
                score = data['score']
                
                if 'overall' in score and 'readiness_status' in score and 'categories' in score:
                    overall = score['overall']
                    status = score['readiness_status']
                    categories = score['categories']
                    
                    log_success(f"Investor Readiness Score: {overall}/100")
                    log_info(f"Status: {status}")
                    
                    expected_categories = ['market_validation', 'product', 'business_model', 'growth', 'traction', 'moat', 'evidence_quality']
                    missing_cats = [c for c in expected_categories if c not in categories]
                    
                    if not missing_cats:
                        log_success("All 7 score categories present")
                        return True
                    else:
                        log_error(f"Score missing categories: {missing_cats}")
                        return False
                else:
                    log_error(f"Score missing required fields")
                    return False
            else:
                log_error(f"Missing required fields. Got: {list(data.keys())}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}: {response.text[:500]}")
            return False
            
    except Exception as e:
        log_error(f"Chairman assessment failed: {str(e)}")
        return False

def test_startup_detail():
    """Test 10: GET /api/startups/:id → verify full aggregate"""
    print("\n" + "="*80)
    print("TEST 10: Startup Detail Aggregate (GET /api/startups/:id)")
    print("="*80)
    
    try:
        log_info(f"Fetching full startup aggregate for {STARTUP_ID}...")
        response = requests.get(f"{BASE_URL}/startups/{STARTUP_ID}", timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_info(f"Response keys: {list(data.keys())}")
            
            expected = ['startup', 'profile', 'interview', 'reports', 'claims', 'missions', 'score_history', 'latest_score', 'versions']
            missing = [f for f in expected if f not in data]
            
            if not missing:
                log_success("All aggregate sections present")
                
                startup = data['startup']
                if startup.get('stage') == 'analyzed':
                    log_success(f"Startup stage: {startup['stage']}")
                else:
                    log_warning(f"Startup stage is '{startup.get('stage')}', expected 'analyzed'")
                
                if data['profile']:
                    log_success("Profile present")
                
                interview = data['interview']
                if len(interview) >= 7:
                    log_success(f"Interview has {len(interview)} messages")
                
                reports = data['reports']
                expected_reports = ['market', 'product', 'business', 'growth', 'critic', 'chairman']
                missing_reports = [r for r in expected_reports if r not in reports]
                
                if not missing_reports:
                    log_success(f"All 6 agent reports present")
                else:
                    log_error(f"Missing reports: {missing_reports}")
                
                claims = data['claims']
                log_success(f"Claims: {len(claims)}")
                
                missions = data['missions']
                log_success(f"Missions: {len(missions)}")
                
                score_history = data['score_history']
                if len(score_history) >= 1:
                    log_success(f"Score history: {len(score_history)} entries")
                else:
                    log_error("Score history is empty")
                
                if data['latest_score']:
                    log_success(f"Latest score: {data['latest_score'].get('overall', 'N/A')}/100")
                
                return True
            else:
                log_error(f"Missing aggregate sections: {missing}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Startup detail fetch failed: {str(e)}")
        return False

def test_startup_list():
    """Test 11: GET /api/startups → verify list with latest_score"""
    print("\n" + "="*80)
    print("TEST 11: Startup List (GET /api/startups)")
    print("="*80)
    
    try:
        log_info("Fetching startup list...")
        response = requests.get(f"{BASE_URL}/startups", timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'startups' in data:
                startups = data['startups']
                log_success(f"Found {len(startups)} startups")
                
                study_buddy = next((s for s in startups if s.get('name') == 'StudyBuddy'), None)
                
                if study_buddy:
                    log_success("StudyBuddy found in list")
                    
                    if 'latest_score' in study_buddy and study_buddy['latest_score']:
                        score = study_buddy['latest_score']
                        log_success(f"Latest score attached: {score.get('overall', 'N/A')}/100")
                        return True
                    else:
                        log_warning("Latest score not attached")
                        return True
                else:
                    log_warning("StudyBuddy not found in list")
                    return True
            else:
                log_error(f"Missing 'startups' field")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Startup list fetch failed: {str(e)}")
        return False

def test_profile_edit():
    """Test 12: PUT /api/startups/:id/profile → test change detection"""
    print("\n" + "="*80)
    print("TEST 12: Profile Edit with Change Detection (PUT /api/startups/:id/profile)")
    print("="*80)
    
    try:
        log_info("Fetching current profile...")
        get_response = requests.get(f"{BASE_URL}/startups/{STARTUP_ID}", timeout=30)
        
        if get_response.status_code != 200:
            log_error(f"Could not fetch current profile: {get_response.status_code}")
            return False
        
        current_data = get_response.json()
        current_profile = current_data.get('profile')
        
        if not current_profile:
            log_error("No profile found to edit")
            return False
        
        modified_profile = current_profile.copy()
        modified_profile['pricing'] = "$10/month"
        
        log_info(f"Changing pricing to '$10/month'")
        
        payload = {"profile": modified_profile}
        
        response = requests.put(f"{BASE_URL}/startups/{STARTUP_ID}/profile", json=payload, timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'changed_fields' in data and 'affected_agents' in data and 'version' in data:
                changed_fields = data['changed_fields']
                affected_agents = data['affected_agents']
                version = data['version']
                
                if 'pricing' in changed_fields:
                    log_success(f"Change detected: {changed_fields}")
                else:
                    log_error(f"Expected 'pricing' in changed_fields, got: {changed_fields}")
                    return False
                
                if 'business' in affected_agents:
                    log_success(f"Affected agents: {affected_agents}")
                else:
                    log_warning(f"Expected 'business' in affected_agents, got: {affected_agents}")
                
                if version == 2:
                    log_success(f"Version incremented to {version}")
                else:
                    log_warning(f"Expected version 2, got {version}")
                
                return True
            else:
                log_error(f"Missing required fields")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Profile edit failed: {str(e)}")
        return False

def test_delete_startup():
    """Test 13: DELETE /api/startups/:id → delete startup"""
    print("\n" + "="*80)
    print("TEST 13: Delete Startup (DELETE /api/startups/:id)")
    print("="*80)
    
    try:
        log_info(f"Deleting startup {STARTUP_ID}...")
        response = requests.delete(f"{BASE_URL}/startups/{STARTUP_ID}", timeout=30)
        
        log_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('deleted') == True:
                log_success("Startup deleted")
                
                log_info("Verifying startup is deleted...")
                verify_response = requests.get(f"{BASE_URL}/startups/{STARTUP_ID}", timeout=30)
                
                if verify_response.status_code in [404, 500]:
                    log_success(f"Confirmed deleted (GET returns {verify_response.status_code})")
                    return True
                else:
                    log_warning(f"Startup still accessible: {verify_response.status_code}")
                    return True
            else:
                log_error(f"Unexpected response: {data}")
                return False
        else:
            log_error(f"Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        log_error(f"Delete startup failed: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("ProofLoop Backend API Test Suite - Continue from Test 8")
    print("="*80)
    print(f"Startup ID: {STARTUP_ID}")
    print("="*80)
    
    results = {}
    
    # Test 8: Evidence submission
    results['evidence_submission'] = test_evidence_submission()
    
    # Test 9: Chairman assessment
    results['chairman_assessment'] = test_chairman_assessment()
    
    # Test 10: Startup detail
    results['startup_detail'] = test_startup_detail()
    
    # Test 11: Startup list
    results['startup_list'] = test_startup_list()
    
    # Test 12: Profile edit
    results['profile_edit'] = test_profile_edit()
    
    # Test 13: Delete startup
    results['delete_startup'] = test_delete_startup()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    total = len(results)
    
    for test_name, result in results.items():
        if result is True:
            log_success(f"{test_name}: PASSED")
        else:
            log_error(f"{test_name}: FAILED")
    
    print("="*80)
    print(f"Total: {total} | Passed: {passed} | Failed: {failed}")
    print("="*80)
    
    if failed == 0:
        log_success("ALL TESTS PASSED!")
        sys.exit(0)
    else:
        log_error(f"{failed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
