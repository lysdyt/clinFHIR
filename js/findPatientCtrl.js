angular.module("sampleApp")
    .controller('findPatientCtrl',
            function($scope,ResourceUtilsSvc,resourceSvc,supportSvc,resourceCreatorSvc,appConfigSvc,modalService){

                $scope.input={mode:'find',gender:'male'};   //will be replaced by name randomizer
                $scope.input.dob = new Date(1982,9,31);     //will be replaced by name randomizer
                $scope.outcome = {log:[]};

                $scope.input.createSamples = true;
                //when the 'Add new patient' is selected...
                $scope.seletNewPatientOption = function(){

                    $scope.input.mode='new'
                    $scope.waiting = true;
                    supportSvc.getRandomName().then(
                        function(data) {
                            try {


                                var user = data.data.results[0];
                                $scope.input.dob = moment(user.dob).format();
                                $scope.input.fname  = user.name.first.toProperCase();
                                $scope.input.lname = user.name.last.toProperCase();
                                $scope.input.gender = user.gender;
                            } catch (ex) {
                                //in the case of an error - simply use the defaults
                                console.log('error getting sample name: ',ex)
                            }

                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    });

                    //alert ('Sorry, new patient functionality not available from here')
                };

                var addLog = function(display) {
                    $scope.outcome.log.push(display);
                };

                $scope.ResourceUtilsSvc = ResourceUtilsSvc;


                //supportSvc.checkReferenceResources

                $scope.selectNewPatient = function(patient) {
                    appConfigSvc.setCurrentPatient(patient);

                    $scope.$close(patient);
                };

                $scope.searchForPatient = function(name) {
                    $scope.nomatch=false;   //if there were no matching patients
                    delete $scope.matchingPatientsList;
                    if (! name) {
                        alert('Please enter a name');
                        return true;
                    }
                    $scope.waiting = true;
                    resourceCreatorSvc.findPatientsByName(name).then(
                        function(data){
                            // ResourceUtilsSvc.getOneLineSummaryOfResource(patient);
                            $scope.matchingPatientsList = data;
                            if (! data || data.length == 0) {
                                $scope.nomatch=true;
                            }


                        },
                        function(err) {
                            modalService.showModal({}, {bodyText: 'Error finding patient - have you selected the correct Data Server?'})
                        }
                    ).finally(function(){
                        $scope.waiting = false;
                    })
                };

                //add - and select - a new patient..
                //note that Grahames server can't handle multiple concurrent requests - whucg is why theres
                //a rather ineligant 'pyramid of doom' sync calls....
                $scope.addNewPatient = function() {
                    $scope.showLog = true;
                    $scope.allowClose = false;
                    $scope.waiting = true;
                    var nameText = $scope.input.fname + " " + $scope.input.lname;
                    addLog('Adding '+nameText);

                    supportSvc.createPatient($scope.input).then(
                        function(patient){
                            var patientId = patient.id;
                            $scope.currentPatient = patient;

                            addLog('Added patient with the id : '+ patientId)
                            appConfigSvc.setCurrentPatient(patient);


                            if ($scope.input.createSamples) {
                                addLog('Checking that the required reference resources exist');
                                supportSvc.checkReferenceResources().then (
                                    function() {
                                        addLog('adding Encounters...');
                                        supportSvc.buildConditionList(patientId,{logFn:addLog}).then(
                                            function(bundleConditions) {
                                                supportSvc.createEncounters(patientId,{},bundleConditions).then(
                                                    function(msg){
                                                        addLog(msg);
                                                        var query = [];

                                                        supportSvc.createObservations(patientId,{logFn:addLog}).then(
                                                            function() {
                                                                supportSvc.buildMedicationList(patientId,{logFn:addLog}).then(
                                                                    function() {
                                                                        supportSvc.createAppointments(patientId,{logFn:addLog}).then(
                                                                            function() {
                                                                                supportSvc.buildAllergiesList(patientId,{logFn:addLog}).then(
                                                                                    function () {
                                                                                        $scope.saving = false;
                                                                                        supportSvc.resetResourceReferences();   //remove all the newly created resources from the reference resource list...
                                                                                        // not yet.. $scope.$close();
                                                                                        appConfigSvc.setCurrentPatient(patient);

                                                                                        $scope.loading = false;
                                                                                        $scope.allowClose = true;
                                                                                        $scope.allDone = true;
                                                                                    },
                                                                                    function (err) {
                                                                                        //error for allergies...
                                                                                        modalService.showModal({}, {bodyText: "Error saving allergies:"+angular.toJson(err)})
                                                                                        $scope.allowClose = true;

                                                                                    }
                                                                                )

                                                                            },
                                                                            function(err) {
                                                                                //error for appointments
                                                                                modalService.showModal({}, {bodyText: "Error saving appointments:"+angular.toJson(err)})
                                                                                $scope.allowClose = true;
                                                                            }
                                                                        )

                                                                    },
                                                                    function(err) {
                                                                        //error for meds
                                                                        modalService.showModal({}, {bodyText: "Error saving meds:"+angular.toJson(err)})
                                                                        $scope.allowClose = true;
                                                                    }



                                                                )


                                                            },function(err) {
                                                                //error for obs
                                                                modalService.showModal({}, {bodyText: "Error saving obs:"+angular.toJson(err)})
                                                                $scope.allowClose = true;

                                                            }
                                                        );



                                                        /* - this is an async create - works for hapi,but not Grahame. Maybe a server option?
                                                         addLog('adding Observations...');
                                                         query.push(supportSvc.createObservations(patientId,{logFn:addLog}));


                                                         addLog('adding Appointments...');
                                                         query.push(supportSvc.createAppointments(patientId,{logFn:addLog}));
                                                         addLog('adding Medication List...');
                                                         query.push(supportSvc.buildMedicationList(patientId,{logFn:addLog}));
                                                         addLog('adding Allergy List...');
                                                         query.push(supportSvc.buildAllergiesList(patientId,{logFn:addLog}));

                                                         $q.all(query).then(
                                                         //regardless of success or failure, turn off the saving flag
                                                         function() {
                                                         $scope.saving = false;
                                                         supportSvc.resetResourceReferences();   //remove all the newly created resources from the reference resource list...
                                                         // not yet.. $scope.$close();
                                                         appConfigSvc.setCurrentPatient(patient);
                                                         $rootScope.$emit('patientSelected',patient);
                                                         $scope.loading = false;
                                                         $scope.allowClose = true;
                                                         $scope.allDone = true;


                                                         },
                                                         function(err) {
                                                         alert('error creating sample resources\n'+angular.toJson(err))
                                                         $scope.allowClose = true;
                                                         $scope.loading = false;
                                                         }
                                                         )


                                                         */


                                                    },
                                                    function(err){
                                                        alert('error creating Encounters '+ angular.toJson(err));
                                                        $scope.allowClose = true;
                                                    }
                                                )




                                            },
                                            function(err) {
                                                alert('error building the condition list ' + angular.toJson(err))
                                                $scope.allowClose = true;
                                            }
                                        )},
                                    function(err){
                                        //service will display error
                                        alert('error checking reference resources')
                                        $scope.allowClose = true;
                                    }
                                ).finally(function(){
                                    $scope.waiting = false;
                                })



                            } else {

                                $scope.waiting = false;
                                $scope.allowClose = true;
                            }


                        },
                        function(err) {
                            var msg = "Unable to create the Patient. This can be caused by a CORS error on the server you're talking to. ";
                            msg += "Here's the error I got: "+angular.toJson(err);
                            modalService.showModal({}, {bodyText: msg})


                            $scope.waiting = false;
                            $scope.allowClose = true;
                        }
                    );


                };




                $scope.cancel = function () {
                    $scope.$close();
                }

        })