class VerboseReporter {
  onTestResult(_test, result) {
    console.log('\n' + result.testFilePath.split('/').pop());
    for (const t of result.testResults) {
      const mark = t.status === 'passed' ? 'pass' : 'FAIL';
      console.log(`  ${mark}  ${t.fullName}`);
    }
  }
  onRunComplete(_contexts, results) {
    const secs = (results.testResults.reduce((s, r) => s + (r.perfStats?.runtime || 0), 0) / 1000).toFixed(1);
    console.log(`\nsuites: ${results.numPassedTestSuites}/${results.numTotalTestSuites} passed`);
    console.log(`tests:  ${results.numPassedTests}/${results.numTotalTests} passed in ${secs}s`);
  }
}
module.exports = VerboseReporter;
