#!/usr/bin/env python3
"""
ProofLoop Backend Test - 3 NEW Endpoints
Tests: Pitch Practice, Mission Due Date, Versions Full
"""

import requests
import json
import time
from typing import Dict, Any

BASE_URL = "https://proofloop-validate.preview.emergentagent.com/api"
STARTUP_ID = "e33ec945-4ece-4eef-a3ad-92c700ba1bda"

def log(msg: str):
    print(f"[TEST] {msg}")

def test_pitch_practice():
    """Test A: Pitch Practice (4 AI calls total)"""
    log("=" * 80)
    log("TEST A: PITCH PRACTICE BACKEND")
    log("=" * 80)
    
    session_id = None
    
    try:
        # 1. POST /api/pitch/start
        log("\n1. Testing POST /api/pitch/start...")
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/pitch/start",
            json={"startup_id": STARTUP_ID},
            timeout=180
        )
        elapsed = time.time() - start_time
        log(f"   Response status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            log(f"   Response: {response.text}")
            return False
        
        data = response.json()
        log(f"   Response keys: {list(data.keys())}")
        
        # Validate response structure
        if 'session_id' not in data:
            log(f"   ❌ FAILED: Missing session_id in response")
            return False
        if 'question' not in data or not data['question']:
            log(f"   ❌ FAILED: Missing or empty question in response")
            return False
        if 'done' not in data or data['done'] != False:
            log(f"   ❌ FAILED: done should be False")
            return False
        if 'question_source' not in data:
            log(f"   ❌ FAILED: Missing question_source in response")
            return False
        if 'feedback' not in data or data['feedback'] is not None:
            log(f"   ❌ FAILED: feedback should be null on start")
            return False
        if 'answer_rating' not in data or data['answer_rating'] is not None:
            log(f"   ❌ FAILED: answer_rating should be null on start")
            return False
        
        session_id = data['session_id']
        log(f"   ✅ PASSED: session_id={session_id[:8]}..., question={data['question'][:50]}...")
        log(f"   question_source: {data['question_source']}")
        
        # 2. POST /api/pitch with strong answer
        log("\n2. Testing POST /api/pitch (strong answer)...")
        strong_answer = "We interviewed 30 parents and 24 said meal planning takes over 2 hours a week; 150 are on our waitlist from two Facebook groups."
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/pitch",
            json={
                "startup_id": STARTUP_ID,
                "session_id": session_id,
                "message": strong_answer
            },
            timeout=180
        )
        elapsed = time.time() - start_time
        log(f"   Response status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            log(f"   Response: {response.text}")
            return False
        
        data = response.json()
        log(f"   Response keys: {list(data.keys())}")
        
        # Validate response structure
        if 'feedback' not in data or not data['feedback']:
            log(f"   ❌ FAILED: Missing or empty feedback in response")
            return False
        if 'answer_rating' not in data or not isinstance(data['answer_rating'], (int, float)):
            log(f"   ❌ FAILED: Missing or invalid answer_rating")
            return False
        if data['answer_rating'] < 1 or data['answer_rating'] > 10:
            log(f"   ❌ FAILED: answer_rating should be 1-10, got {data['answer_rating']}")
            return False
        if 'question' not in data or not data['question']:
            log(f"   ❌ FAILED: Missing or empty question in response")
            return False
        if 'done' not in data or not isinstance(data['done'], bool):
            log(f"   ❌ FAILED: Missing or invalid done flag")
            return False
        if 'question_source' not in data:
            log(f"   ❌ FAILED: Missing question_source in response")
            return False
        
        log(f"   ✅ PASSED: feedback={data['feedback'][:50]}..., answer_rating={data['answer_rating']}")
        log(f"   question={data['question'][:50]}..., done={data['done']}")
        
        # 3. POST /api/pitch with weak answer
        log("\n3. Testing POST /api/pitch (weak answer)...")
        weak_answer = "We just know parents will love it, everyone we talk to says it's a great idea."
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/pitch",
            json={
                "startup_id": STARTUP_ID,
                "session_id": session_id,
                "message": weak_answer
            },
            timeout=180
        )
        elapsed = time.time() - start_time
        log(f"   Response status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            log(f"   Response: {response.text}")
            return False
        
        data = response.json()
        
        # Validate weak answer gets low rating
        if 'answer_rating' not in data or data['answer_rating'] > 5:
            log(f"   ⚠️  WARNING: Expected low rating (<=5) for weak answer, got {data.get('answer_rating')}")
        else:
            log(f"   ✅ PASSED: Low rating for weak answer: {data['answer_rating']}")
        
        log(f"   feedback={data['feedback'][:50]}...")
        
        # 4. POST /api/pitch/debrief
        log("\n4. Testing POST /api/pitch/debrief...")
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/pitch/debrief",
            json={
                "startup_id": STARTUP_ID,
                "session_id": session_id
            },
            timeout=180
        )
        elapsed = time.time() - start_time
        log(f"   Response status: {response.status_code} (took {elapsed:.1f}s)")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            log(f"   Response: {response.text}")
            return False
        
        data = response.json()
        log(f"   Response keys: {list(data.keys())}")
        
        # Validate debrief structure
        if 'debrief' not in data:
            log(f"   ❌ FAILED: Missing debrief in response")
            return False
        
        debrief = data['debrief']
        required_fields = ['overall_rating', 'verdict', 'strengths', 'weaknesses', 'coaching', 'best_moment', 'worst_moment']
        for field in required_fields:
            if field not in debrief:
                log(f"   ❌ FAILED: Missing {field} in debrief")
                return False
        
        if not isinstance(debrief['overall_rating'], (int, float)) or debrief['overall_rating'] < 0 or debrief['overall_rating'] > 100:
            log(f"   ❌ FAILED: overall_rating should be 0-100, got {debrief['overall_rating']}")
            return False
        
        if not isinstance(debrief['strengths'], list):
            log(f"   ❌ FAILED: strengths should be a list")
            return False
        
        if not isinstance(debrief['weaknesses'], list):
            log(f"   ❌ FAILED: weaknesses should be a list")
            return False
        
        if not isinstance(debrief['coaching'], list):
            log(f"   ❌ FAILED: coaching should be a list")
            return False
        
        log(f"   ✅ PASSED: overall_rating={debrief['overall_rating']}, verdict={debrief['verdict'][:50]}...")
        log(f"   strengths: {len(debrief['strengths'])} items")
        log(f"   weaknesses: {len(debrief['weaknesses'])} items")
        log(f"   coaching: {len(debrief['coaching'])} items")
        
        # 5. GET /api/pitch/:startupId
        log("\n5. Testing GET /api/pitch/:startupId...")
        response = requests.get(f"{BASE_URL}/pitch/{STARTUP_ID}", timeout=30)
        log(f"   Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            log(f"   Response: {response.text}")
            return False
        
        data = response.json()
        
        if 'sessions' not in data:
            log(f"   ❌ FAILED: Missing sessions in response")
            return False
        
        # Find our session
        our_session = None
        for session in data['sessions']:
            if session['session_id'] == session_id:
                our_session = session
                break
        
        if not our_session:
            log(f"   ❌ FAILED: Could not find session {session_id} in sessions list")
            return False
        
        # Validate session structure
        if 'messages' not in our_session:
            log(f"   ❌ FAILED: Missing messages in session")
            return False
        
        messages = our_session['messages']
        # Should have: 3 assistant questions + 2 user answers + 1 debrief message = 6 total
        if len(messages) < 6:
            log(f"   ⚠️  WARNING: Expected at least 6 messages (3 questions + 2 answers + 1 debrief), got {len(messages)}")
        
        # Count message types
        assistant_msgs = [m for m in messages if m['role'] == 'assistant']
        user_msgs = [m for m in messages if m['role'] == 'user']
        
        log(f"   ✅ PASSED: Found session with {len(messages)} messages ({len(assistant_msgs)} assistant, {len(user_msgs)} user)")
        
        if 'debrief' not in our_session or not our_session['debrief']:
            log(f"   ❌ FAILED: Missing debrief in session")
            return False
        
        log(f"   ✅ PASSED: Session has debrief attached")
        
        # 6. Validation tests
        log("\n6. Testing validation...")
        
        # Empty body for start
        response = requests.post(f"{BASE_URL}/pitch/start", json={}, timeout=30)
        if response.status_code != 400:
            log(f"   ❌ FAILED: Empty body should return 400, got {response.status_code}")
            return False
        log(f"   ✅ PASSED: Empty body returns 400")
        
        # Missing session/message for pitch
        response = requests.post(f"{BASE_URL}/pitch", json={"startup_id": STARTUP_ID}, timeout=30)
        if response.status_code != 400:
            log(f"   ❌ FAILED: Missing session/message should return 400, got {response.status_code}")
            return False
        log(f"   ✅ PASSED: Missing session/message returns 400")
        
        # Debrief with random session_id (no answers)
        import uuid
        fake_session = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/pitch/debrief",
            json={"startup_id": STARTUP_ID, "session_id": fake_session},
            timeout=30
        )
        if response.status_code != 400:
            log(f"   ❌ FAILED: Debrief with no answers should return 400, got {response.status_code}")
            return False
        log(f"   ✅ PASSED: Debrief with no answers returns 400")
        
        log("\n✅ ALL PITCH PRACTICE TESTS PASSED")
        return True
        
    except Exception as e:
        log(f"\n❌ EXCEPTION in pitch practice test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_mission_due_date():
    """Test B: Mission Due Date (no AI)"""
    log("\n" + "=" * 80)
    log("TEST B: MISSION DUE DATE")
    log("=" * 80)
    
    try:
        # 1. GET startup to find a pending mission
        log("\n1. Getting startup detail to find pending mission...")
        response = requests.get(f"{BASE_URL}/startups/{STARTUP_ID}", timeout=30)
        log(f"   Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        missions = data.get('missions', [])
        
        # Find first pending mission
        pending_mission = None
        for mission in missions:
            if mission['status'] == 'pending':
                pending_mission = mission
                break
        
        if not pending_mission:
            log(f"   ❌ FAILED: No pending missions found")
            return False
        
        mission_id = pending_mission['id']
        log(f"   ✅ Found pending mission: {mission_id}")
        log(f"   Mission title: {pending_mission['title']}")
        
        # 2. PUT with valid date
        log("\n2. Testing PUT /api/missions/:id with valid date...")
        response = requests.put(
            f"{BASE_URL}/missions/{mission_id}",
            json={"due_date": "2026-01-15"},
            timeout=30
        )
        log(f"   Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            log(f"   Response: {response.text}")
            return False
        
        data = response.json()
        if 'mission' not in data:
            log(f"   ❌ FAILED: Missing mission in response")
            return False
        
        if data['mission']['due_date'] != '2026-01-15':
            log(f"   ❌ FAILED: Expected due_date '2026-01-15', got {data['mission']['due_date']}")
            return False
        
        log(f"   ✅ PASSED: due_date set to 2026-01-15")
        
        # 3. PUT with past date (still valid format)
        log("\n3. Testing PUT with past date (2020-01-01)...")
        response = requests.put(
            f"{BASE_URL}/missions/{mission_id}",
            json={"due_date": "2020-01-01"},
            timeout=30
        )
        log(f"   Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            log(f"   Response: {response.text}")
            return False
        
        log(f"   ✅ PASSED: Past date accepted (overdue logic is frontend-side)")
        
        # 4. PUT with invalid date format
        log("\n4. Testing PUT with invalid date format...")
        response = requests.put(
            f"{BASE_URL}/missions/{mission_id}",
            json={"due_date": "not-a-date"},
            timeout=30
        )
        log(f"   Response status: {response.status_code}")
        
        if response.status_code != 400:
            log(f"   ❌ FAILED: Expected 400, got {response.status_code}")
            return False
        
        log(f"   ✅ PASSED: Invalid date format returns 400")
        
        # 5. PUT with null to clear
        log("\n5. Testing PUT with null to clear due_date...")
        response = requests.put(
            f"{BASE_URL}/missions/{mission_id}",
            json={"due_date": None},
            timeout=30
        )
        log(f"   Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            log(f"   Response: {response.text}")
            return False
        
        data = response.json()
        if data['mission']['due_date'] is not None:
            log(f"   ❌ FAILED: Expected due_date null, got {data['mission']['due_date']}")
            return False
        
        log(f"   ✅ PASSED: due_date cleared (null)")
        
        # 6. Set back to overdue date for frontend test
        log("\n6. Setting due_date back to 2020-01-01 for frontend test...")
        response = requests.put(
            f"{BASE_URL}/missions/{mission_id}",
            json={"due_date": "2020-01-01"},
            timeout=30
        )
        log(f"   Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        log(f"   ✅ PASSED: due_date set to 2020-01-01 (overdue)")
        
        # 7. Verify with GET
        log("\n7. Verifying with GET /api/startups/:id...")
        response = requests.get(f"{BASE_URL}/startups/{STARTUP_ID}", timeout=30)
        log(f"   Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        missions = data.get('missions', [])
        
        # Find our mission
        our_mission = None
        for mission in missions:
            if mission['id'] == mission_id:
                our_mission = mission
                break
        
        if not our_mission:
            log(f"   ❌ FAILED: Could not find mission {mission_id}")
            return False
        
        if our_mission['due_date'] != '2020-01-01':
            log(f"   ❌ FAILED: Expected due_date '2020-01-01', got {our_mission['due_date']}")
            return False
        
        log(f"   ✅ PASSED: Confirmed mission.due_date === '2020-01-01'")
        
        log("\n✅ ALL MISSION DUE DATE TESTS PASSED")
        return True
        
    except Exception as e:
        log(f"\n❌ EXCEPTION in mission due date test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_versions_full():
    """Test C: Versions Full (no AI)"""
    log("\n" + "=" * 80)
    log("TEST C: VERSIONS FULL")
    log("=" * 80)
    
    try:
        # 1. GET /api/startups/:id/versions-full
        log("\n1. Testing GET /api/startups/:id/versions-full...")
        response = requests.get(f"{BASE_URL}/startups/{STARTUP_ID}/versions-full", timeout=30)
        log(f"   Response status: {response.status_code}")
        
        if response.status_code != 200:
            log(f"   ❌ FAILED: Expected 200, got {response.status_code}")
            log(f"   Response: {response.text}")
            return False
        
        data = response.json()
        
        if 'versions' not in data:
            log(f"   ❌ FAILED: Missing versions in response")
            return False
        
        versions = data['versions']
        
        if len(versions) < 3:
            log(f"   ⚠️  WARNING: Expected at least 3 versions (v1, v2, v3), got {len(versions)}")
        
        log(f"   ✅ Found {len(versions)} versions")
        
        # Validate each version has required fields
        required_fields = ['id', 'version', 'profile', 'changed_fields', 'created_at']
        for i, version in enumerate(versions):
            for field in required_fields:
                if field not in version:
                    log(f"   ❌ FAILED: Version {i+1} missing {field}")
                    return False
            
            # Validate profile is a full object with 15 fields
            profile = version['profile']
            if not isinstance(profile, dict):
                log(f"   ❌ FAILED: Version {i+1} profile is not an object")
                return False
            
            # Check for key profile fields
            expected_profile_fields = [
                'startup_name', 'idea', 'target_customer', 'customer_problem',
                'current_alternatives', 'solution', 'value_proposition', 'competitors',
                'business_model', 'pricing', 'growth_strategy', 'first_100_users',
                'traction', 'existing_evidence', 'key_assumptions'
            ]
            
            missing_fields = [f for f in expected_profile_fields if f not in profile]
            if missing_fields:
                log(f"   ❌ FAILED: Version {i+1} profile missing fields: {missing_fields}")
                return False
            
            log(f"   ✅ Version {version['version']}: id={version['id'][:8]}..., changed_fields={version['changed_fields']}, created_at={version['created_at']}")
        
        # Verify versions are ordered ascending by version number
        version_numbers = [v['version'] for v in versions]
        if version_numbers != sorted(version_numbers):
            log(f"   ❌ FAILED: Versions not ordered ascending by version number")
            return False
        
        log(f"   ✅ PASSED: Versions ordered ascending (v1, v2, v3, ...)")
        
        log("\n✅ ALL VERSIONS FULL TESTS PASSED")
        return True
        
    except Exception as e:
        log(f"\n❌ EXCEPTION in versions full test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    log("=" * 80)
    log("PROOFLOOP BACKEND TEST - 3 NEW ENDPOINTS")
    log("=" * 80)
    log(f"Base URL: {BASE_URL}")
    log(f"Startup ID: {STARTUP_ID}")
    log("")
    
    results = {
        "Pitch Practice": False,
        "Mission Due Date": False,
        "Versions Full": False
    }
    
    # Run tests
    results["Pitch Practice"] = test_pitch_practice()
    results["Mission Due Date"] = test_mission_due_date()
    results["Versions Full"] = test_versions_full()
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        log(f"{test_name}: {status}")
    
    all_passed = all(results.values())
    log("\n" + "=" * 80)
    if all_passed:
        log("✅ ALL TESTS PASSED")
    else:
        log("❌ SOME TESTS FAILED")
    log("=" * 80)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit(main())
